import { bindLogoutButtons, populateAuthUI, requireAuth } from "./session.js";

// Profile hydration only fills the fields that should reflect the logged-in user's identity.
async function initProfilePage() {
  try {
    // This page is protected, so missing auth results in a redirect before the profile UI is hydrated.
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    // Shared navbar values are updated first, then profile-only text targets are filled below.
    const profile = auth.profile;
    populateAuthUI(profile);
    bindLogoutButtons();

    const profileName = document.querySelector("[data-profile-username]");
    const profileJoined = document.querySelector("[data-profile-created-at]");
    const profileCardName = document.querySelector("[data-profile-card-username]");

    // These guards keep the script safe even if you later redesign sections of the profile page.
    if (profileName) {
      profileName.textContent = profile?.username || "player";
    }

    if (profileJoined && profile?.created_at) {
      profileJoined.textContent = "CTF Player · joined " + new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long"
      });
    }

    if (profileCardName) {
      profileCardName.textContent = profile?.username || "player";
    }

    // Trigger dynamic profile components
    const solvedRaw = JSON.parse(window.localStorage.getItem("mkk_ctf_challenges_solved") || "[]");
    const staticDataRaw = JSON.parse(window.localStorage.getItem("mkk_ctf_challenges_static") || "[]");

    // Polyfill normalized solves in case the user hasn't visited the challenges page recently
    const localSolves = (Array.isArray(solvedRaw) ? solvedRaw : []).map(item => {
      if (typeof item === "string" || typeof item === "number") {
        return { id: String(item), timestamp: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString() };
      }
      return item;
    });
    
    // Static challenges fall back to empty if missing; challenges.js manages defaults
    const allChallenges = Array.isArray(staticDataRaw) ? staticDataRaw : [];

    // Ensure the profile.js init method is bound before executing
    if (typeof window.initProfileData === "function") {
      window.initProfileData(auth.user, profile, localSolves, allChallenges);
    } else {
      console.warn("window.initProfileData is not ready or missing.");
    }

  } catch (error) {
    // The alert keeps profile boot issues visible while the page is still in a mostly static prototype state.
    window.alert(error?.message || "Unable to initialize the profile session.");
  }
}

// The module runs after the page HTML, so no explicit DOMContentLoaded wrapper is needed here.
initProfilePage();
