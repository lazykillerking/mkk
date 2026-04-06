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
  } catch (error) {
    // The alert keeps profile boot issues visible while the page is still in a mostly static prototype state.
    window.alert(error?.message || "Unable to initialize the profile session.");
  }
}

// The module runs after the page HTML, so no explicit DOMContentLoaded wrapper is needed here.
initProfilePage();
