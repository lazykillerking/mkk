import { bindLogoutButtons, populateAuthUI, requireAuth } from "./session.js";

// Rules page auth bootstrap.
// Mirrors the exact pattern used by challenges-page.js, tickets-page.js, and profile-page.js:
//   1. Gate the page — unauthenticated users are redirected to login.
//   2. Hydrate every [data-auth-username] / [data-auth-score] element in the navbar.
//   3. Wire up the logout button so it signs the user out and returns to login.
async function initRulesPage() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      // requireAuth already redirected; nothing more to do.
      return;
    }

    populateAuthUI(auth.profile, auth.user);
    bindLogoutButtons();
  } catch (error) {
    // Visible alert keeps auth failures obvious during development.
    window.alert(error?.message || "Unable to initialise the rules session.");
  }
}

initRulesPage();
