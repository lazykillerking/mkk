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
  const POS_K    = 0.22;   // stiffness — higher = snappier
  const POS_DAMP = 0.78;   // damping   — < 1 = some lag

  // ── Deformation state (scale + rotation via transform) ────────
  let prevCX = cX, prevCY = cY;
  let sx = 1, sy = 1;           // current scaleX, scaleY
  let svX = 0, svY = 0;         // scale spring velocities
  const SCALE_K    = 0.14;      // lower  = more lag / overshoot
  const SCALE_DAMP = 0.70;      // lower  = more wobble

  let rot = 0, rotV = 0;
  const ROT_K    = 0.10;
  const ROT_DAMP = 0.72;

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
      const stretch  = Math.min(speed * 0.065, 0.75);
      const angle    = Math.atan2(vy, vx);

      // Primary axis (along motion) grows; perpendicular axis squeezes gently
      tSX = 1 + stretch;
      tSY = Math.max(0.55, 1 - stretch * 0.38);

      // Tilt in direction of motion — fade out when nearly still
      const rotFade = Math.min(speed / 3, 1);
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

// Render Dashboard Data
function renderDashboardData(data) {
  solvesTbody.innerHTML = '';
  
  if (!Array.isArray(data)) return;

  data.forEach(solve => {
    const tr = document.createElement("tr");
    
    const tdChal = document.createElement("td");
    tdChal.className = "cell-chal";
    tdChal.textContent = solve.challenges?.title || "Unknown";
    
    const tdUser = document.createElement("td");
    tdUser.className = "cell-user";
    tdUser.textContent = solve.users?.username || "Unknown";
    
    const tdTime = document.createElement("td");
    tdTime.className = "cell-time";
    const d = new Date(solve.solved_at);
    tdTime.textContent = isNaN(d) ? "--" : d.toLocaleString();

    tr.appendChild(tdChal);
    tr.appendChild(tdUser);
    tr.appendChild(tdTime);
    solvesTbody.appendChild(tr);
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

    // Securely evaluate the password on the database server AND fetch data
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
      adminInput.disabled = true;
      authFeedback.textContent = "> ACCESS GRANTED. DECRYPTING...";
      authFeedback.style.color = "var(--admin-cyan)";
      authContainer.classList.add("state-success");
      
      renderDashboardData(dashboardData);

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
