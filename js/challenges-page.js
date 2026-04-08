import { bindLogoutButtons, populateAuthUI, requireAuth } from "./session.js";

// Challenges page auth bootstrap.
// Mirrors the pattern used by dashboard-page.js and profile-page.js:
//   1. Gate the page — unauthenticated users are redirected to login.
//   2. Hydrate every [data-auth-username] / [data-auth-score] element in the navbar.
//   3. Wire up the logout button so it signs the user out and returns to login.
async function initChallengesPage() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      // requireAuth already redirected; nothing more to do.
      return;
    }

    populateAuthUI(auth.profile, auth.user);
    bindLogoutButtons();

    // Check frontend admin state directly from newly fetched user profile boolean.
    if (typeof window.initAdminMode === "function") {
      window.initAdminMode(!!auth.profile?.is_admin);
    }
  } catch (error) {
    // Visible alert keeps auth failures obvious during development.
    window.alert(error?.message || "Unable to initialise the challenge session.");
  }
}

initChallengesPage();
