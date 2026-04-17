import { requireSupabaseClient } from "../js/supabase.js";
import { getAuthUser, getCurrentUserProfile } from "../js/session.js";

// DOM Elements
const authContainer = document.getElementById("auth-container");
const adminAuthForm = document.getElementById("admin-auth-form");
const adminInput = document.getElementById("admin-password");
const inputDotsContainer = document.getElementById("input-dots");
const authFeedback = document.getElementById("auth-feedback");
const trollScreen = document.getElementById("troll-screen");
const bootScreen = document.getElementById("boot-screen");
const bootTextContainer = document.getElementById("boot-text-container");
const dashboardContainer = document.getElementById("dashboard-container");
const solvesTbody = document.getElementById("solves-tbody");

// State
let systemPassword = null;
let currentCursorClass = '';
let attemptCount = 0;

// Cursor Physics Logic
function initCursor() {
  const cursor   = document.getElementById("custom-cursor");
  const follower = document.getElementById("custom-cursor-follower");

  // ── Target mouse ──────────────────────────────────────────────
  let mouseX = window.innerWidth  / 2;
  let mouseY = window.innerHeight / 2;

  // ── Inner cursor position spring (gives it mass / lag) ────────
  let cX = mouseX, cY = mouseY;
  let posVX = 0,   posVY = 0;
  const POS_K    = 0.13;   // lower  = more lag / gliding trail
  const POS_DAMP = 0.84;   // higher = more momentum, floatier

  // ── Deformation state (scale + rotation via transform) ────────
  let prevCX = cX, prevCY = cY;
  let sx = 1, sy = 1;           // current scaleX, scaleY
  let svX = 0, svY = 0;         // scale spring velocities
  const SCALE_K    = 0.07;      // lower  = slower/softer return to circle
  const SCALE_DAMP = 0.66;      // lower  = more overshoot/wobble on stop

  let rot = 0, rotV = 0;
  const ROT_K    = 0.07;
  const ROT_DAMP = 0.76;

  // ── Click compress ────────────────────────────────────────────
  let clickScale = 1, clickV = 0;

  // ── Outer follower ────────────────────────────────────────────
  let fX = mouseX, fY = mouseY;

  // ─────────────────────────────────────────────────────────────
  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Context detection (unchanged logic)
    let target = e.target;
    let found = false;
    while (target && target !== document.body) {
      if (target.dataset?.cursor) {
        const nc = `cursor-${target.dataset.cursor}`;
        if (currentCursorClass !== nc) {
          if (currentCursorClass) document.body.classList.remove(currentCursorClass);
          document.body.classList.add(nc);
          currentCursorClass = nc;
        }
        found = true;
        break;
      }
      target = target.parentElement;
    }
    if (!found && currentCursorClass) {
      document.body.classList.remove(currentCursorClass);
      currentCursorClass = '';
    }
  });

  // Click: compress → bounce
  window.addEventListener("mousedown", () => { clickV = -0.38; });
  window.addEventListener("mouseup",   () => { clickV += 0.30; });

  // ─────────────────────────────────────────────────────────────
  function raf() {

    // ── 1. Position spring ──────────────────────────────────────
    posVX = posVX * POS_DAMP + (mouseX - cX) * POS_K;
    posVY = posVY * POS_DAMP + (mouseY - cY) * POS_K;
    cX += posVX;
    cY += posVY;

    // Blob velocity (derived from lagged position — smoother than raw mouse delta)
    const vx    = cX - prevCX;
    const vy    = cY - prevCY;
    const speed = Math.sqrt(vx * vx + vy * vy);
    prevCX = cX;
    prevCY = cY;

    // ── 2. Deformation targets ──────────────────────────────────
    const inContext = !!currentCursorClass;
    let tSX, tSY, tRot;

    if (inContext) {
      // Stable in hover context — return to circle + very slight scale-up
      tSX  = 1.12;
      tSY  = 1.12;
      tRot = 0;
    } else {
      // More pronounced stretch — liquid droplet feel
      const stretch = Math.min(speed * 0.10, 1.3);
      const angle   = Math.atan2(vy, vx);

      // Long axis stretches significantly; short axis squeezes deeper
      tSX = 1 + stretch;
      tSY = Math.max(0.32, 1 - stretch * 0.58);

      // Rotation fades in smoothly with speed
      const rotFade = Math.min(speed / 2.5, 1);
      tRot = (angle * 180 / Math.PI) * rotFade;
    }

    // ── 3. Spring on scale (overshoot = wobble when stopping) ───
    svX = svX * SCALE_DAMP + (tSX - sx) * SCALE_K;
    svY = svY * SCALE_DAMP + (tSY - sy) * SCALE_K;
    sx += svX;
    sy += svY;

    // ── 4. Spring on rotation ───────────────────────────────────
    let dAngle = tRot - rot;
    if (dAngle >  180) dAngle -= 360;
    if (dAngle < -180) dAngle += 360;
    rotV = rotV * ROT_DAMP + dAngle * ROT_K;
    rot += rotV;

    // ── 5. Click spring ─────────────────────────────────────────
    clickV     *= 0.76;
    clickScale += clickV;
    clickScale += (1 - clickScale) * 0.20;
    clickScale  = Math.max(0.5, Math.min(1.45, clickScale));

    // ── 6. Apply transform (GPU only — no width/height) ─────────
    cursor.style.left = `${cX}px`;
    cursor.style.top  = `${cY}px`;

    if (inContext) {
      // CSS class handles shape — just center it
      cursor.style.transform = `translate(-50%, -50%) scale(${(clickScale).toFixed(3)})`;
    } else {
      // Rotate to align with direction, then stretch (capsule in motion direction)
      cursor.style.transform =
        `translate(-50%, -50%) ` +
        `rotate(${rot.toFixed(2)}deg) ` +
        `scaleX(${(sx * clickScale).toFixed(3)}) ` +
        `scaleY(${(sy * clickScale).toFixed(3)})`;
    }

    // ── 7. Outer follower ───────────────────────────────────────
    fX += (mouseX - fX) * 0.10;
    fY += (mouseY - fY) * 0.10;
    follower.style.left = `${fX}px`;
    follower.style.top  = `${fY}px`;

    requestAnimationFrame(raf);
  }
  raf();
}

// Input Mask Logic
function initInputMask() {
  inputDotsContainer.innerHTML = '';
  // The system password is max 10 characters
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement("div");
    slot.className = "pass-slot";
    
    const char = document.createElement("div");
    char.className = "pass-char";
    
    const under = document.createElement("div");
    under.className = "pass-under";
    under.textContent = "_";
    
    slot.appendChild(char);
    slot.appendChild(under);
    inputDotsContainer.appendChild(slot);
  }
}

function updateInputMask() {
  const len = adminInput.value.length;
  const slots = inputDotsContainer.querySelectorAll(".pass-slot");
  
  slots.forEach((slot, i) => {
    const char = slot.querySelector(".pass-char");
    if (i < len) {
      char.textContent = "*";
      char.classList.add("is-filled");
    } else {
      char.textContent = "";
      char.classList.remove("is-filled");
    }
  });
}

adminInput.addEventListener("input", updateInputMask);

// Typewriter Effect Generator
async function typeLines(element, lines, delayBetweenLines = 400) {
  element.innerHTML = '';
  for (const line of lines) {
    const p = document.createElement("p");
    element.appendChild(p);
    
    for (let i = 0; i < line.length; i++) {
      p.textContent += line[i];
      p.classList.add("cursor-blink");
      await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
    }
    
    p.classList.remove("cursor-blink");
    await new Promise(r => setTimeout(r, delayBetweenLines));
  }
}

// Sequence: Troll Error
async function runTrollSequence() {
  trollScreen.classList.remove("is-hidden");
  // The HTML has hardcoded text to avoid jumpiness during typing sequence, 
  // but we can animate it or just show it based on preference.
  // For the prompt: Sarcastic throw-off.
  const lines = [
    "INITIATING SECURE HANDSHAKE...",
    "VERIFYING CREDENTIALS...",
    "[ERR_0x1A4] PERMISSION_DENIED",
    "HAHA. NICE TRY. YOU ARE NOT AN ADMIN.",
    "> IP LOGGED.",
    "> DISPATCHING CYBER POLICE...",
    "> JUST KIDDING.",
    "> BUT SERIOUSLY. LEAVE."
  ];
  
  const container = trollScreen.querySelector('.terminal-text');
  await typeLines(container, lines, 600);
  
  // Optional: Redirect away after trolling
  setTimeout(() => {
    window.location.replace("/dashboard/");
  }, 3000);
}

// Sequence: Boot UI
async function runBootSequence() {
  bootScreen.classList.remove("is-hidden");
  const lines = [
    "MKK OS v4.1.2",
    "Initializing root protocols...",
    "Loading kernel modules [OK]",
    "Mounting encrypted volume... [OK]",
    "Establishing secure tunnel...",
    "WARNING: UNAUTHORIZED ACCESS PROHIBITED",
    "Awaiting authentication."
  ];
  await typeLines(bootTextContainer, lines, 300);
  
  // Transition to Auth UI
  bootScreen.classList.add("is-hidden");
  authContainer.classList.remove("is-hidden");
  adminInput.focus();
}

function initDashboardTabs() {
  const tabs = document.querySelectorAll(".dash-tab");
  const contents = document.querySelectorAll(".tab-content");
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  const subtabs = document.querySelectorAll(".dash-subtab");
  const subContents = document.querySelectorAll(".subtab-content");
  subtabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subtabs.forEach(t => t.classList.remove('active'));
      subContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`subtab-${tab.dataset.subtab}`).classList.add('active');
    });
  });
}

async function loadAdminChallenges() {
  const supabase = requireSupabaseClient();
  const form = document.getElementById("challenge-admin-form");
  const listContainer = document.getElementById("challenge-admin-list");
  const categorySelect = document.getElementById("challenge-admin-category");
  
  const CATEGORIES = ["WEB", "CRYPTO", "FORENSICS", "PWN", "REVERSE", "MISC", "OSINT", "WELCOME"];
  if (categorySelect) categorySelect.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

  let currentEditId = null;
  let challenges = [];

  const fetchChallenges = async () => {
    // Only select the known columns to avoid RLS block on protected columns
    const { data, error } = await supabase.from("challenges").select("id, title, description, category, points, solves_count, file_url").order("id");
    if (!error && data) {
      challenges = data;
      renderList();
    } else if (error) {
      console.error("Error fetching admin challenges:", error);
    }
  };

  const refBtn = document.getElementById("refresh-challenges-btn");
  if (refBtn) {
    refBtn.onclick = () => {
      fetchChallenges();
    };
  }

  const escapeHtml = (val) => String(val).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const renderList = () => {
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="challenge-admin-list__items">' + challenges.map(challenge => {
      return (
        '<div class="challenge-admin-list__item">' +
          "<div>" +
            "<strong>" + escapeHtml(challenge.title) + "</strong>" +
            '<p>' + escapeHtml(challenge.category) + " | " + Number(challenge.points).toLocaleString() + " pts</p>" +
          "</div>" +
          '<div style="display:flex;gap:0.4rem;">' +
            '<button class="challenge-admin-remove" type="button" data-edit-id="' + challenge.id + '" style="background:var(--admin-cyan-dim);color:var(--admin-cyan);">&#9998;</button>' +
            '<button class="challenge-admin-remove" type="button" data-remove-id="' + challenge.id + '">&times;</button>' +
          '</div>' +
        "</div>"
      );
    }).join("") + "</div>";
  };

  if (listContainer) {
    listContainer.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-id]");
      if (editBtn) {
        const id = parseInt(editBtn.getAttribute("data-edit-id"), 10);
        const chal = challenges.find(c => c.id === id);
        if (chal) {
          currentEditId = id;
          form.querySelector('[name="name"]').value = chal.title || "";
          form.querySelector('[name="description"]').value = chal.description || "";
          form.querySelector('[name="points"]').value = chal.points || 0;
          form.querySelector('[name="flag"]').value = "";
          form.querySelector('[name="flag"]').placeholder = "Leave blank to keep existing flag";
          form.querySelector('[name="author"]').value = chal.author || "";
          form.querySelector('[name="difficulty"]').value = chal.difficulty || "Easy";
          form.querySelector('[name="solves"]').value = chal.solves_count || 0;
          form.querySelector('[name="file_url"]').value = chal.file_url || "";
          form.querySelector('[name="hints"]').value = Array.isArray(chal.hints) ? chal.hints.join("\n") : (chal.hints || "");
          categorySelect.value = chal.category || "WEB";
          form.querySelector("[type='submit']").textContent = "Update challenge";
          const cancelBtn = document.getElementById("challenge-cancel-btn");
          if (cancelBtn) cancelBtn.classList.remove("is-hidden");
          form.scrollIntoView({ behavior: "smooth" });
        }
        return;
      }

      const removeBtn = e.target.closest("[data-remove-id]");
      if (removeBtn && confirm("Sure you want to delete this challenge?")) {
        const id = removeBtn.getAttribute("data-remove-id");
        const { error } = await supabase.from("challenges").delete().eq("id", id);
        if (error) alert("Error: " + error.message);
        else { alert("Deleted."); fetchChallenges(); }
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const challengeData = {
        title: String(formData.get("name") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        category: String(formData.get("category") || "WEB").trim(),
        points: parseInt(formData.get("points") || "0", 10),
        solves_count: parseInt(formData.get("solves") || "0", 10),
        file_url: String(formData.get("file_url") || "").trim() || null,
      };

      const flagVal = String(formData.get("flag") || "").trim();
      if (flagVal !== "") {
        challengeData.flag = flagVal;
      }

      if (currentEditId) {
        const { error } = await supabase.from("challenges").update(challengeData).eq("id", currentEditId);
        if (error) alert("Update failed: " + error.message);
        else {
          alert("Updated!");
        }
      } else {
        const { error } = await supabase.from("challenges").insert([challengeData]);
        if (error) alert("Create failed: " + error.message);
        else alert("Created!");
      }

      currentEditId = null;
      form.querySelector("[type='submit']").textContent = "Create challenge";
      const cancelBtn = document.getElementById("challenge-cancel-btn");
      if (cancelBtn) cancelBtn.classList.add("is-hidden");

      form.reset();
      categorySelect.value = "WEB";
      fetchChallenges();
    });

    const cancelBtn = document.getElementById("challenge-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        currentEditId = null;
        form.reset();
        form.querySelector("[name='flag']").placeholder = "MKK{example_flag}";
        form.querySelector("[type='submit']").textContent = "Create challenge";
        categorySelect.value = "WEB";
        cancelBtn.classList.add("is-hidden");
      });
    }
  }

  fetchChallenges();
}

async function loadDataExplorer() {
  const supabase = requireSupabaseClient();
  const accordionList = document.getElementById("data-accordion-list");
  if (!accordionList) return;
  accordionList.innerHTML = '<div class="terminal-text">> FETCHING DATA...</div>';

  const refBtn = document.getElementById("refresh-data-btn");
  if (refBtn) {
    refBtn.onclick = () => {
      loadDataExplorer();
    };
  }
  
  const { data: challenges, error } = await supabase.rpc('get_admin_challenge_summaries', { p_password: systemPassword });
  if (error || !challenges) {
    accordionList.innerHTML = '<div class="terminal-text is-error">> ERROR FETCHING CHALLENGE SUMMARIES.</div>';
    return;
  }

  const escapeHtml = (val) => String(val).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  accordionList.innerHTML = challenges.map(chal => `
    <div class="accordion-item" data-challenge-id="${chal.id}">
      <div class="accordion-header">
        <span>[${escapeHtml(chal.category)}] ${escapeHtml(chal.title)} (${chal.points} pts)</span>
        <span>${chal.solves ? chal.solves.length : 0} solves ▼</span>
      </div>
      <div class="accordion-content">
        ${(!chal.solves || chal.solves.length === 0) ? '<p class="terminal-text">No solves yet.</p>' : chal.solves.map(solve => `
          <div class="user-accordion-item" data-user-id="${solve.user_id}">
            <div class="user-accordion-header">
              <span>👤 ${escapeHtml(solve.username)}</span>
              <span>Completed: ${new Date(solve.solved_at).toLocaleString()} ▼</span>
            </div>
            <div class="user-accordion-content accordion-content">
              <!-- Dynamically populated -->
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Handle accordion toggles
  accordionList.addEventListener("click", async (e) => {
    // Challenge Level
    const chalHeader = e.target.closest(".accordion-header");
    if (chalHeader) {
      const content = chalHeader.nextElementSibling;
      content.classList.toggle("expanded");
      return;
    }

    // User Level
    const userHeader = e.target.closest(".user-accordion-header");
    if (userHeader) {
      const userItem = userHeader.closest(".user-accordion-item");
      const chalItem = userItem.closest(".accordion-item");
      const content = userHeader.nextElementSibling;
      
      const isExpanded = content.classList.contains("expanded");
      if (isExpanded) {
        content.classList.remove("expanded");
        return;
      }

      // Fetch dynamically
      content.classList.add("expanded");
      content.innerHTML = '<p class="terminal-text">> LOADING USER DETAILS...</p>';
      
      const chalId = chalItem.getAttribute("data-challenge-id");
      const userId = userItem.getAttribute("data-user-id");

      const { data: details, error: err } = await supabase.rpc('get_admin_user_challenge_details', {
        p_password: systemPassword,
        p_challenge_id: parseInt(chalId, 10),
        p_user_id: userId
      });

      if (err || !details) {
        content.innerHTML = '<p class="terminal-text is-error">> ERROR LOADING DATA. ' + escapeHtml(err?.message || '') + '</p>';
        return;
      }

      const diffMs = (details.solved_at && details.first_opened_at) 
        ? new Date(details.solved_at).getTime() - new Date(details.first_opened_at).getTime() 
        : 0;
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);

      content.innerHTML = `
        <div class="user-details">
          <div class="user-detail-section">
            <h4>PERSONAL INFO</h4>
            <p><strong>Email:</strong> ${escapeHtml(details.user.email || 'N/A')}</p>
            <p><strong>Name:</strong> ${escapeHtml(details.user.first_name || '')} ${escapeHtml(details.user.last_name || '')}</p>
            <p><strong>Country:</strong> ${escapeHtml(details.user.country || 'N/A')}</p>
            <p><strong>Bio:</strong> ${escapeHtml(details.user.about || 'N/A')}</p>
          </div>
          <div class="user-detail-section">
            <h4>TIMING</h4>
            <p><strong>First Opened:</strong> ${details.first_opened_at ? new Date(details.first_opened_at).toLocaleString() : 'N/A'}</p>
            <p><strong>Solved At:</strong> ${details.solved_at ? new Date(details.solved_at).toLocaleString() : 'N/A'}</p>
            <p><strong>Time spent:</strong> ${hours}h ${mins}m</p>
          </div>
        </div>
        <div class="user-detail-section" style="margin-top:1rem;">
          <h4>FLAGS SUBMITTED (${details.flags ? details.flags.length : 0})</h4>
          <div class="flag-list">
            ${details.flags && details.flags.length ? details.flags.map(f => `
              <div class="flag-attempt ${f.is_correct ? 'correct' : 'incorrect'}">
                <span style="color:var(--admin-${f.is_correct ? 'cyan' : 'red'})">[${f.is_correct ? 'CORRECT' : 'INCORRECT'}]</span> 
                ${escapeHtml(f.provided_flag)} 
                <span style="color:var(--admin-dim);font-size:0.7rem;">(${new Date(f.submitted_at).toLocaleTimeString()})</span>
              </div>
            `).join('') : '<p>No flags found.</p>'}
          </div>
        </div>
      `;
    }
  });
}

// Main Flow
async function initialize() {
  initCursor();
  initInputMask();

  const supabase = requireSupabaseClient();
  const user = await getAuthUser();
  
  if (!user) {
    window.location.replace("/index.html");
    return;
  }

  const profile = await getCurrentUserProfile();
  
  if (!profile || profile.is_admin !== true) {
    runTrollSequence();
    return;
  }

  // The password remains strictly in the database.
  // We will evaluate it via an RPC call during form submission.

  // Tiny intentional load delay before booting
  setTimeout(() => {
    runBootSequence();
  }, 400);

  // Form Submission
  adminAuthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = adminInput.value;
    
    // Disable input while verifying
    adminInput.disabled = true;

    // Securely evaluate the password on the database server AND fetch test data
    const { data: dashboardData, error } = await supabase.rpc('get_admin_solves_dashboard', { p_password: val });

    if (error) {
      if (error.message.includes('Invalid Password')) {
        // Handled below as failed attempt
      } else {
        console.error("Auth verify error:", error);
        authFeedback.textContent = "> ERROR: AUTH SERVER UNREACHABLE.";
        adminInput.disabled = false;
        return;
      }
    }
    
    // If successful, data is an array (or empty array)
    if (!error && Array.isArray(dashboardData)) {
      // Success
      systemPassword = val; // Store global system password for RPCs
      adminInput.disabled = true;
      authFeedback.textContent = "> ACCESS GRANTED. DECRYPTING...";
      authFeedback.style.color = "var(--admin-cyan)";
      authContainer.classList.add("state-success");
      
      initDashboardTabs();
      loadAdminChallenges();
      loadDataExplorer();

      setTimeout(() => {
        authContainer.classList.add("is-hidden");
        dashboardContainer.classList.remove("is-hidden");
        document.body.classList.remove(currentCursorClass); // Reset cursor context
      }, 1200);

    } else {
      // Error
      attemptCount++;
      adminInput.value = "";
      updateInputMask(); // Clear dots
      
      const formWrapper = document.querySelector('.input-wrapper');
      formWrapper.classList.remove("shake");
      void formWrapper.offsetWidth; // trigger reflow
      formWrapper.classList.add("shake");
      
      if (attemptCount >= 3) {
        authFeedback.textContent = "> CRITICAL FAILURE. LOCKDOWN INITIATED.";
        // Keep input disabled
        setTimeout(() => window.location.replace("/dashboard/"), 2000);
      } else {
        authFeedback.textContent = `> AUTHENTICATION FAILED. (${3 - attemptCount} ATTEMPTS REMAINING)`;
        adminInput.disabled = false;
        adminInput.focus();
      }
    }
  });
}

// Start
document.addEventListener("DOMContentLoaded", initialize);
