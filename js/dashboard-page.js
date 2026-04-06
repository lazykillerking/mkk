import { bindLogoutButtons, populateAuthUI, requireAuth } from "./session.js";

// Dashboard bootstraps protected data before filling the welcome panel and navbar.
async function initDashboardPage() {
  try {
    // The route guard redirects unauthenticated visitors back to `/` before the dashboard renders.
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    // Shared navbar placeholders and page-specific placeholders are filled from the same profile object.
    const profile = auth.profile;
    populateAuthUI(profile);
    bindLogoutButtons();

    const welcomeName = document.querySelector("[data-dashboard-username]");
    const welcomeScore = document.querySelector("[data-dashboard-score]");
    const welcomeJoined = document.querySelector("[data-dashboard-created-at]");

    // Each target is optional so the script can stay resilient if the markup changes later.
    if (welcomeName) {
      welcomeName.textContent = profile?.username || "player";
    }

    if (welcomeScore) {
      welcomeScore.textContent = Number(profile?.score || 0).toLocaleString("en-US");
    }

    if (welcomeJoined && profile?.created_at) {
      welcomeJoined.textContent = new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
  } catch (error) {
    // Protected pages use a simple alert for now so setup/auth failures are still visible during development.
    window.alert(error?.message || "Unable to initialize the dashboard session.");
  }
}

// Running immediately is fine because the module is loaded after the page markup.
initDashboardPage();
