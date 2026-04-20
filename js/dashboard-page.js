import { bindLogoutButtons, getDisplayUsername, populateAuthUI, requireAuth } from "./session.js";
import { getUserStats } from "./stats.js";
import { requireSupabaseClient } from "./supabase.js";

function formatTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getOrdinalLabel(position) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

async function fetchUserRank(client, userId) {
  const { data, error } = await client
    .from("user_rankings")
    .select("rank")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return 0;
  }

  return Number(data?.rank || 0);
}

function buildBloodAchievements(userId, userSolves, challengeMap, challengeSolveRows) {
  const achievements = new Map([
    [1, []],
    [2, []],
    [3, []]
  ]);

  if (!userId || !Array.isArray(userSolves) || !Array.isArray(challengeSolveRows)) {
    return achievements;
  }

  const solveLookup = new Map();
  challengeSolveRows.forEach(function (row) {
    const challengeId = row.challenge_id;
    if (!solveLookup.has(challengeId)) {
      solveLookup.set(challengeId, []);
    }
    solveLookup.get(challengeId).push(row);
  });

  solveLookup.forEach(function (rows) {
    rows.sort(function (a, b) {
      return new Date(a.solved_at).getTime() - new Date(b.solved_at).getTime();
    });
  });

  userSolves.forEach(function (solve) {
    const rows = solveLookup.get(solve.id) || [];
    const placement = rows.findIndex(function (row) {
      return row.user_id === userId;
    });

    if (placement < 0 || placement > 2) {
      return;
    }

    const position = placement + 1;
    const challenge = challengeMap.get(solve.id);
    achievements.get(position).push({
      name: challenge?.name || "Unknown challenge",
      timestamp: solve.timestamp
    });
  });

  return achievements;
}

function renderBloodAchievements(container, achievements) {
  if (!container) {
    return;
  }

  const html = [1, 2, 3].map(function (position) {
    const items = achievements.get(position) || [];
    const label = getOrdinalLabel(position);
    const count = items.length;
    const latest = items
      .slice()
      .sort(function (a, b) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })[0];

    const summary = latest
      ? `${escapeHtml(latest.name)} · ${escapeHtml(formatTimeAgo(latest.timestamp))}`
      : `No ${label.toLowerCase()} blood yet.`;

    const detail = count === 1 ? "challenge" : "challenges";

    return `
      <div class="first-blood-entry first-blood-entry--${position === 1 ? "first" : position === 2 ? "second" : "third"}">
        <div class="entry-title"><span>${label}</span> Blood</div>
        <div class="entry-count">${count}</div>
        <p>${count} ${detail} · ${summary}</p>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

async function initDashboardPage() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    const profile = auth.profile;
    const username = getDisplayUsername(profile, auth.user);
    populateAuthUI(profile, auth.user);
    bindLogoutButtons();

    const client = requireSupabaseClient();

    const [
      { data: solvesData },
      { data: challengesData },
      rank
    ] = await Promise.all([
      client.from("solves").select("challenge_id, solved_at").eq("user_id", auth.user.id),
      client.from("challenges").select("id, title, category, points"),
      fetchUserRank(client, auth.user.id)
    ]);

    const backendSolves = (solvesData || []).map(function (row) {
      return {
        id: row.challenge_id,
        timestamp: row.solved_at
      };
    });

    const allChallenges = (challengesData || []).map(function (row) {
      return {
        id: row.id,
        name: row.title,
        category: row.category,
        points: row.points
      };
    });

    const challengeMap = new Map(allChallenges.map(function (challenge) {
      return [challenge.id, challenge];
    }));

    const stats = getUserStats(backendSolves, allChallenges);
    const displayScore = profile?.score || 0;

    const welcomeNames = document.querySelectorAll("[data-dashboard-username]");
    const welcomeScore = document.querySelector("[data-dashboard-score]");
    const welcomeJoined = document.querySelector("[data-dashboard-created-at]");
    const elTotalScore = document.getElementById("dashboard-total-score");
    const elSolved = document.getElementById("dashboard-solved");
    const elRank = document.getElementById("dashboard-rank");
    const elPerformance = document.getElementById("dashboard-performance");
    const elFeed = document.getElementById("dashboard-feed");
    const elBloodAchievements = document.getElementById("dashboard-blood-achievements");

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

    if (elTotalScore) {
      elTotalScore.setAttribute("data-countup", String(displayScore));
    }

    if (elSolved) {
      elSolved.setAttribute("data-countup", String(stats.totalSolves));
    }

    if (elRank) {
      elRank.setAttribute("data-countup", String(rank));
    }

    if (elPerformance && stats.categoryStats) {
      elPerformance.innerHTML = "";
      const topCats = stats.categoryStats.slice(0, 5);
      topCats.forEach(function (cat) {
        const cls = cat.percent > 70 ? " bar-fill--strong" : "";
        elPerformance.innerHTML += `
          <div class="performance-row">
            <div class="performance-labels"><span>${escapeHtml(cat.label)}</span><span>${cat.percent}%</span></div>
            <div class="bar-track"><span class="bar-fill${cls}" data-bar-width="${cat.percent}"></span></div>
          </div>
        `;
      });
    }

    if (elFeed) {
      elFeed.innerHTML = "";
      const sortedSolves = [...backendSolves]
        .sort(function (a, b) {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })
        .slice(0, 5);

      if (sortedSolves.length === 0) {
        elFeed.innerHTML = `<div style="text-align:center; padding:1.5rem; color: var(--text-muted); font-size: 0.9em;">No challenges solved yet.</div>`;
      } else {
        sortedSolves.forEach(function (solve, index) {
          const challenge = challengeMap.get(solve.id);
          if (!challenge) {
            return;
          }

          const activeClass = index === 0 ? " feed-row--active" : "";
          elFeed.innerHTML += `
            <div class="feed-row${activeClass}">
              <span class="feed-check">✔</span>
              <span>${escapeHtml(username)}</span>
              <span>→</span>
              <span>${escapeHtml(challenge.name)}</span>
              <span class="feed-points">+${challenge.points}</span>
              <span class="feed-time">${formatTimeAgo(solve.timestamp)}</span>
            </div>
          `;
        });
      }
    }

    if (elBloodAchievements) {
      const solvedChallengeIds = [...new Set(backendSolves.map(function (solve) {
        return solve.id;
      }))];

      let challengeSolveRows = [];
      if (solvedChallengeIds.length > 0) {
        const { data, error } = await client
          .from("solves")
          .select("challenge_id, user_id, solved_at")
          .in("challenge_id", solvedChallengeIds);

        if (!error && Array.isArray(data)) {
          challengeSolveRows = data;
        }
      }

      const achievements = buildBloodAchievements(auth.user.id, backendSolves, challengeMap, challengeSolveRows);
      renderBloodAchievements(elBloodAchievements, achievements);
    }

    window.requestAnimationFrame(function () {
      if (window.runCountUp) {
        if (elTotalScore) window.runCountUp(elTotalScore);
        if (elSolved) window.runCountUp(elSolved);
        if (elRank) window.runCountUp(elRank);
      }
      if (window.initBars && elPerformance) {
        window.initBars(elPerformance.querySelectorAll("[data-bar-width]"));
      }
    });

    client
      .channel("dashboard_profile_updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${auth.user.id}` }, async function (payload) {
        const previousScore = Number(auth.profile?.score || displayScore || 0);
        const updatedProfile = payload.new;
        auth.profile = {
          ...auth.profile,
          ...updatedProfile
        };
        const updatedUsername = getDisplayUsername(auth.profile, auth.user);
        populateAuthUI(auth.profile, auth.user);

        welcomeNames.forEach(function (node) {
          node.textContent = updatedUsername;
        });

        if (welcomeJoined && updatedProfile?.created_at) {
          welcomeJoined.textContent = new Date(updatedProfile.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        }

        const newDisplayScore = Number(updatedProfile?.score ?? previousScore);
        if (welcomeScore && Number(welcomeScore.textContent.replace(/,/g, "")) !== newDisplayScore) {
          welcomeScore.textContent = Number(newDisplayScore).toLocaleString("en-US");
        }

        if (elTotalScore) {
          elTotalScore.setAttribute("data-countup", String(newDisplayScore));
          if (window.runCountUp) window.runCountUp(elTotalScore);
        }

        if (elRank) {
          const latestRank = await fetchUserRank(client, auth.user.id);
          elRank.setAttribute("data-countup", String(latestRank));
          if (window.runCountUp) window.runCountUp(elRank);
        }
      })
      .subscribe();
  } catch (error) {
    window.alert(error?.message || "Unable to initialize the dashboard session.");
  }
}

initDashboardPage();
