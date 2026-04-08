import { bindLogoutButtons, getDisplayUsername, populateAuthUI, requireAuth } from "./session.js";
import { getUserStats } from "./stats.js";
import { requireSupabaseClient } from "./supabase.js";

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
    const username = getDisplayUsername(profile, auth.user);
    populateAuthUI(profile, auth.user);
    bindLogoutButtons();

    const profileName = document.querySelector("[data-profile-username]");
    const profileJoined = document.querySelector("[data-profile-created-at]");
    const profileCardName = document.querySelector("[data-profile-card-username]");
    const profileCardBio = document.querySelector("[data-profile-card-bio]");
    const profileAbout = document.querySelector("[data-profile-about]");

    // These guards keep the script safe even if you later redesign sections of the profile page.
    if (profileName) {
      profileName.textContent = username;
    }

    if (profileJoined && profile?.created_at) {
      profileJoined.textContent = "CTF Player · joined " + new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long"
      });
    }

    if (profileCardName) {
      profileCardName.textContent = username;
    }

    // Hydrate the exported hacker card's bio
    if (profileCardBio) {
      profileCardBio.textContent = profile?.about || "I break things for fun.";
    }

    // Hydrate the main identity column's bio
    if (profileAbout) {
      profileAbout.textContent = profile?.about || "I break things for fun.";
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("success") === "profile_updated") {
      window.setTimeout(() => {
        alert("Profile updated successfully!");
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 500);
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

    const stats = getUserStats(localSolves, allChallenges);

    // Ensure the profile.js init method is bound before executing.
    // Because the HTML loads a deferred module script together with a deferred classic script,
    // the init function may not always be defined immediately at this point.
    let initAttempts = 0;
    while (initAttempts < 10) {
      if (typeof window.initProfileData === "function") {
        window.initProfileData(auth.user, profile, localSolves, allChallenges, stats);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      initAttempts += 1;
    }

    if (initAttempts >= 10) {
      console.warn("window.initProfileData is not ready or missing.");
    }

    // Subscribe to real-time profile updates from Supabase
    // This listens for changes made directly in the database (e.g., admin edits)
    // and updates the UI without requiring a page refresh or re-login
    const client = requireSupabaseClient();
    client
      .channel('profile_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${auth.user.id}` }, (payload) => {
        // payload.new contains the updated user row
        const updatedProfile = payload.new;
        // Update the cached profile in auth object
        auth.profile = updatedProfile;
        const username = getDisplayUsername(updatedProfile, auth.user);
        // Re-hydrate navbar and shared UI elements
        populateAuthUI(updatedProfile, auth.user);

        // Update profile-specific elements on the page
        if (profileName) {
          profileName.textContent = username;
        }
        if (profileJoined && updatedProfile?.created_at) {
          profileJoined.textContent = "CTF Player · joined " + new Date(updatedProfile.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long"
          });
        }
        if (profileCardName) {
          profileCardName.textContent = username;
        }
        if (profileCardBio) {
          profileCardBio.textContent = updatedProfile?.about || "I break things for fun.";
        }
        if (profileAbout) {
          profileAbout.textContent = updatedProfile?.about || "I break things for fun.";
        }
      })
      .subscribe();

    // Remove loading state from the body to reveal actual data
    document.body.classList.remove("is-loading");

  } catch (error) {
    // The alert keeps profile boot issues visible while the page is still in a mostly static prototype state.
    document.body.classList.remove("is-loading");
    window.alert(error?.message || "Unable to initialize the profile session.");
  }
}

// The module runs after the page HTML, so no explicit DOMContentLoaded wrapper is needed here.
initProfilePage();
