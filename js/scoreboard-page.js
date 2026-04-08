import { bindLogoutButtons, populateAuthUI, requireAuth } from "./session.js";

// Scoreboard protection is optional in the original requirement, but keeping it protected is consistent.
async function initScoreboardPage() {
  try {
    // Even though the scoreboard is still simple, it follows the same auth gate as the other protected pages.
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    // The current scoreboard only needs navbar hydration plus a working logout button.
    populateAuthUI(auth.profile, auth.user);
    bindLogoutButtons();
  } catch (error) {
    // Development-time alert keeps route/config failures obvious on this placeholder page too.
    window.alert(error?.message || "Unable to initialize the scoreboard session.");
  }
}

// Fire immediately because the module is loaded at the end of the page body.
initScoreboardPage();
