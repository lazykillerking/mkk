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
  const cursor = document.getElementById("custom-cursor");
  const follower = document.getElementById("custom-cursor-follower");
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let followerX = mouseX;
  let followerY = mouseY;
  
  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Immediate update for the dot
    cursor.style.left = `${mouseX}px`;
    cursor.style.top = `${mouseY}px`;

    // Context detection
    let target = e.target;
    let foundContext = false;
    
    while (target && target !== document.body) {
      if (target.dataset && target.dataset.cursor) {
        const newClass = `cursor-${target.dataset.cursor}`;
        if (currentCursorClass !== newClass) {
          if (currentCursorClass) document.body.classList.remove(currentCursorClass);
          document.body.classList.add(newClass);
          currentCursorClass = newClass;
        }
        foundContext = true;
        break;
      }
      target = target.parentElement;
    }
    
    if (!foundContext && currentCursorClass) {
      document.body.classList.remove(currentCursorClass);
      currentCursorClass = '';
    }
  });

  // Smooth follow for the ring
  function animateFollower() {
    followerX += (mouseX - followerX) * 0.15;
    followerY += (mouseY - followerY) * 0.15;
    follower.style.left = `${followerX}px`;
    follower.style.top = `${followerY}px`;
    requestAnimationFrame(animateFollower);
  }
  animateFollower();
}

// Input Mask Logic
function updateInputMask() {
  const len = adminInput.value.length;
  inputDotsContainer.innerHTML = '';
  for (let i = 0; i < len; i++) {
    const dot = document.createElement("div");
    dot.className = "pass-dot";
    inputDotsContainer.appendChild(dot);
  }
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
