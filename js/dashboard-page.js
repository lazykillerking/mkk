import { bindLogoutButtons, getDisplayUsername, populateAuthUI, requireAuth } from "./session.js";
import { getUserStats } from "./stats.js";
import { requireSupabaseClient } from "./supabase.js";

// Utility to format time ago
function formatTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Dashboard bootstraps protected data before filling the welcome panel and navbar.
async function initDashboardPage() {
  try {
    // The route guard redirects unauthenticated visitors back to `/` before the dashboard renders.
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    // Shared navbar placeholders and page-specific placeholders use the profile row first, then auth fallback.
    const profile = auth.profile;
    const username = getDisplayUsername(profile, auth.user);
    populateAuthUI(profile, auth.user);
    bindLogoutButtons();

    // Reconcile stats from local storage solves
    const solvedRaw = JSON.parse(window.localStorage.getItem("mkk_ctf_challenges_solved") || "[]");
    const staticDataRaw = JSON.parse(window.localStorage.getItem("mkk_ctf_challenges_static") || "[]");

    const localSolves = (Array.isArray(solvedRaw) ? solvedRaw : []).map(item => {
      if (typeof item === "string" || typeof item === "number") {
        return { id: String(item), timestamp: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString() };
      }
      return item;
    });
    
    const allChallenges = Array.isArray(staticDataRaw) ? staticDataRaw : [];
    const stats = getUserStats(localSolves, allChallenges);
    
    // We use locally calculated total score since the CTF relies on local solving
    const displayScore = stats.totalScore || profile?.score || 0;

    const welcomeNames = document.querySelectorAll("[data-dashboard-username]");
    const welcomeScore = document.querySelector("[data-dashboard-score]");
    const welcomeJoined = document.querySelector("[data-dashboard-created-at]");

    // Username can appear in multiple dashboard spots, so every matching node is hydrated.
    welcomeNames.forEach(function (node) {
      node.textContent = username;
    });

    if (welcomeScore) {
      welcomeScore.textContent = Number(displayScore).toLocaleString("en-US");
    }

    if (welcomeJoined && profile?.created_at) {
      welcomeJoined.textContent = new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }

    // Hydrate top stats
    const elTotalScore = document.getElementById("dashboard-total-score");
    const elSolved = document.getElementById("dashboard-solved");
    
    if (elTotalScore) elTotalScore.setAttribute("data-countup", String(displayScore));
    if (elSolved) elSolved.setAttribute("data-countup", String(stats.totalSolves));

    // Hydrate Performance Bars
    const elPerformance = document.getElementById("dashboard-performance");
    if (elPerformance && stats.categoryStats) {
      elPerformance.innerHTML = "";
      const topCats = stats.categoryStats.slice(0, 5);
      topCats.forEach(cat => {
        const cls = cat.percent > 70 ? " bar-fill--strong" : "";
        elPerformance.innerHTML += `
          <div class="performance-row">
            <div class="performance-labels"><span>${cat.label}</span><span>${cat.percent}%</span></div>
            <div class="bar-track"><span class="bar-fill${cls}" data-bar-width="${cat.percent}"></span></div>
          </div>
        `;
      });
    }

    // Hydrate Recent Solves Feed
    const elFeed = document.getElementById("dashboard-feed");
    if (elFeed) {
      elFeed.innerHTML = "";
      const sortedSolves = [...localSolves].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
      
      if (sortedSolves.length === 0) {
        elFeed.innerHTML = `<div style="text-align:center; padding:1.5rem; color: var(--text-muted); font-size: 0.9em;">No challenges solved yet.</div>`;
      } else {
        sortedSolves.forEach((s, idx) => {
          const c = allChallenges.find(x => x.id === s.id);
          if (!c) return;
          const activeClass = idx === 0 ? " feed-row--active" : "";
          elFeed.innerHTML += `
            <div class="feed-row${activeClass}">
              <span class="feed-check">✔</span>
              <span>${username}</span>
              <span>→</span>
              <span>${c.name}</span>
              <span class="feed-points">+${c.points}</span>
              <span class="feed-time">${formatTimeAgo(s.timestamp)}</span>
            </div>
          `;
        });
      }
    }

    // Safely re-trigger animations after DOM updates are rendered
    window.requestAnimationFrame(() => {
      if(window.runCountUp) {
        if(elTotalScore) window.runCountUp(elTotalScore);
        if(elSolved) window.runCountUp(elSolved);
      }
      if(window.initBars && elPerformance) {
        window.initBars(elPerformance.querySelectorAll("[data-bar-width]"));
      }
    });

    // Subscribe to real-time profile updates
    const client = requireSupabaseClient();
    client
      .channel('dashboard_profile_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${auth.user.id}` }, (payload) => {
        const updatedProfile = payload.new;
        auth.profile = updatedProfile;
        const username = getDisplayUsername(updatedProfile, auth.user);
        populateAuthUI(updatedProfile, auth.user);

        // Update dashboard-specific elements
        welcomeNames.forEach(function (node) {
          node.textContent = username;
        });
        if (welcomeJoined && updatedProfile?.created_at) {
          welcomeJoined.textContent = new Date(updatedProfile.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        }
        // Update score if changed
        const newDisplayScore = stats.totalScore || updatedProfile?.score || 0;
        if (welcomeScore && Number(welcomeScore.textContent.replace(/,/g, '')) !== newDisplayScore) {
          welcomeScore.textContent = Number(newDisplayScore).toLocaleString("en-US");
          if (elTotalScore) {
            elTotalScore.setAttribute("data-countup", String(newDisplayScore));
            if (window.runCountUp) window.runCountUp(elTotalScore);
          }
        }
      })
      .subscribe();

  } catch (error) {
    // Protected pages use a simple alert for now so setup/auth failures are still visible during development.
    window.alert(error?.message || "Unable to initialize the dashboard session.");
  }
}

// Running immediately is fine because the module is loaded after the page markup.
initDashboardPage();
