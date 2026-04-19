import { bindLogoutButtons, getDisplayUsername, populateAuthUI, requireAuth } from "./session.js";
import { requireSupabaseClient } from "./supabase.js";

// This module renders the scoreboard as a live paginated user registry.
// It relies on a server-side Supabase view for ranking and joins two realtime channels
// so updates to users or solves refresh the list without a manual browser reload.
const USERS_PAGE_SIZE = 24;
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const AVATAR_PALETTE = ["#00e5ff", "#35e28f", "#ffb400", "#ff7a90", "#86a8ff", "#8ff1ff"];
const PODIUM_CATEGORY_PALETTE = ["#00e5ff", "#35e28f", "#ffb400", "#ff7a90", "#86a8ff", "#ff8a3d", "#a98bff", "#5cf2c8"];

// Helper to sanitize values before inserting them into HTML.
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Determines whether a user has been active in the last 24 hours.
function isActiveWithin24Hours(lastActiveAt) {
  if (!lastActiveAt) {
    return false;
  }

  const timestamp = new Date(lastActiveAt).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= ACTIVE_WINDOW_MS;
}

// Fallback time formatting for users who do not have a server-side joined_ago string.
function formatTimeAgo(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return "joined recently";
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `joined ${Math.max(minutes, 1)}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `joined ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `joined ${days}d ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `joined ${months}mo ago`;
  }

  return `joined ${Math.floor(months / 12)}y ago`;
}

function getInitials(username) {
  return String(username || "").trim().slice(0, 2).toUpperCase() || "??";
}

function getAvatarColor(username) {
  let hash = 0;
  const value = String(username || "");

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function slugifyProfileUrl(username) {
  return `/users?username=${encodeURIComponent(username)}`;
}

function getCategoryColor(category) {
  let hash = 0;
  const value = String(category || "Unknown").toUpperCase();

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return PODIUM_CATEGORY_PALETTE[Math.abs(hash) % PODIUM_CATEGORY_PALETTE.length];
}

function buildPodiumBreakdownMarkup(user, breakdown) {
  if (!user || !breakdown || breakdown.totalSolves < 1 || breakdown.slices.length < 1) {
    return `
      <div class="users-podium-base users-podium-base--empty" aria-hidden="true">
        <div class="users-podium-base__chart users-podium-base__chart--empty">
          <span class="users-podium-base__total">0</span>
          <span class="users-podium-base__caption">solves</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="users-podium-base" aria-label="${escapeHtml(user.username)} solved challenges by category">
      <div class="users-podium-base__details">
        <div class="users-podium-base__chart" style="--podium-pie:${escapeHtml(breakdown.gradient)};">
          <div class="users-podium-base__core">
            <span class="users-podium-base__total">${Number(breakdown.totalSolves).toLocaleString("en-US")}</span>
            <span class="users-podium-base__caption">solves</span>
          </div>
        </div>
        <div class="users-podium-base__legend" aria-hidden="true">
          ${breakdown.slices.map(function (slice) {
            return `
              <span class="users-podium-base__legend-item">
                <span class="users-podium-base__legend-dot" style="background:${escapeHtml(slice.color)};"></span>
                <span class="users-podium-base__legend-text">${escapeHtml(slice.label)}</span>
              </span>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

function attachProfileLinks(root) {
  root.querySelectorAll("[data-profile-link]").forEach(function (node) {
    if (node.dataset.navBound === "true") {
      return;
    }

    const href = node.getAttribute("data-profile-link");
    node.dataset.navBound = "true";
    node.addEventListener("click", function () {
      window.location.href = href;
    });
    node.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = href;
      }
    });
  });
}

function normalizeUser(row, index) {
  return {
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    joined_ago: row.joined_ago,
    score: Number(row.score || 0),
    solves_count: Number(row.solves_count || 0),
    last_active_at: row.last_active_at,
    rank: Number(row.rank || index + 1),
    active_in_last_24h: isActiveWithin24Hours(row.last_active_at)
  };
}

function normalizeUsers(rows) {
  return rows.map(function (row, index) {
    return normalizeUser(row, index);
  });
}

function applyCountUp(node, value) {
  if (!node) {
    return;
  }

  node.setAttribute("data-countup", String(value));
  if (typeof window.runCountUp === "function") {
    window.runCountUp(node);
    return;
  }

  node.textContent = Number(value || 0).toLocaleString("en-US");
}

function createPodiumCard(user, rank) {
  if (!user) {
    return `
      <div class="users-podium-slot users-podium-slot--rank-${rank} users-podium-slot--empty">
        <div class="users-podium-card glass-card">
          <p>awaiting rank #${rank}</p>
        </div>
        <div class="users-podium-base"></div>
      </div>
    `;
  }

  const crown = rank === 1 ? '<span class="users-podium-card__crown" aria-hidden="true">♛</span>' : "";
  const breakdownMarkup = buildPodiumBreakdownMarkup(user, user.category_breakdown);
  return `
    <div class="users-podium-slot users-podium-slot--rank-${rank}" data-profile-link="${escapeHtml(slugifyProfileUrl(user.username))}" tabindex="0" role="link" aria-label="Open ${escapeHtml(user.username)} profile">
      <article class="glass-card users-podium-card">
        <div class="users-avatar-hex users-podium-card__avatar" style="background:${getAvatarColor(user.username)};">${escapeHtml(getInitials(user.username))}</div>
        
        <div class="users-podium-card__identity">
          <span class="users-podium-card__rank">[${rank}] ${crown}</span>
          <span class="users-podium-card__name">${escapeHtml(user.username)}</span>
        </div>
        
        <div class="users-podium-card__metric">
          <div class="users-podium-card__score">
            <svg class="users-podium-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>
            ${Number(user.score).toLocaleString("en-US")}
          </div>
          <p class="users-podium-card__solves">${Number(user.solves_count).toLocaleString("en-US")} SOLVES</p>
        </div>
      </article>
      ${breakdownMarkup}
    </div>
  `;
}

function createUserCard(user, currentUserId) {
  const isCurrentUser = user.id === currentUserId;
  const activeClass = user.active_in_last_24h ? " is-active" : "";
  const selfClass = isCurrentUser ? " users-user-card--self" : "";
  return `
    <article class="glass-card users-user-card${selfClass}" data-profile-link="${escapeHtml(slugifyProfileUrl(user.username))}" tabindex="0" role="link" aria-label="Open ${escapeHtml(user.username)} profile">
      <div class="users-user-card__top">
        <div class="users-avatar-circle" style="background:${getAvatarColor(user.username)};">${escapeHtml(getInitials(user.username))}</div>
        <span class="users-user-card__status${activeClass}" aria-label="${user.active_in_last_24h ? "Active in the last 24 hours" : "Inactive"}"></span>
      </div>
      <div>
        <div class="users-user-card__name">${escapeHtml(user.username)}</div>
        <p class="users-user-card__meta">${escapeHtml(user.joined_ago || formatTimeAgo(user.created_at))}</p>
      </div>
      <p class="users-user-card__details"><span class="users-user-card__points">${Number(user.score).toLocaleString("en-US")} pts</span> · ${Number(user.solves_count).toLocaleString("en-US")} solves</p>
    </article>
  `;
}


function setActiveFilter(filterName) {
  document.querySelectorAll(".users-filter").forEach(function (button) {
    const isActive = button.dataset.filter === filterName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

// Helper for counting records from Supabase without fetching full rows.
// The scoreboard summary needs counts from the ranking view instead of the raw users table.
async function fetchMetricCount(client, tableName, applyFilters) {
  // Head-count queries keep the hero metrics cheap and avoid pulling full row payloads.
  const baseQuery = client.from(tableName).select("id", { count: "exact", head: true });
  const query = typeof applyFilters === "function" ? applyFilters(baseQuery) : baseQuery;
  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return Number(count || 0);
}

async function fetchSummary(client, currentProfile) {
  // Summary metrics are fetched separately from paginated rows so the hero stays globally accurate.
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const totalUsers = await fetchMetricCount(client, "user_rankings");

  const { count: activeCount, error: activeError } = await client
    .from("user_rankings")
    .select("id", { count: "exact", head: true })
    .gte("last_active_at", activeSince);
  if (activeError) {
    throw activeError;
  }

  const { count: solvesCount, error: solvesError } = await client
    .from("user_rankings")
    .select("id", { count: "exact", head: true })
    .gte("solves_count", 1);
  if (solvesError) {
    throw solvesError;
  }

  const activeUsers = Number(activeCount || 0);
  const usersWithSolves = Number(solvesCount || 0);

  let userRank = 0;
  if (currentProfile?.id) {
    const { data, error } = await client
      .from("user_rankings")
      .select("rank")
      .eq("id", currentProfile.id)
      .single();

    if (!error && data) {
      userRank = Number(data.rank || 0);
    }
  }

  return {
    totalUsers,
    activeUsers,
    usersWithSolves,
    topTenUsers: Math.min(totalUsers, 10),
    userRank
  };
}

async function fetchUsersPage(client, offset, limit) {
  // Registry rows are fetched in deterministic server-defined rank order.
  const { data, error } = await client
    .from("user_rankings")
    .select("id, username, created_at, joined_ago, score, solves_count, last_active_at, rank")
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function fetchChallengeCategoryMap(client) {
  const { data, error } = await client
    .from("challenges")
    .select("id, category");

  if (error) {
    throw error;
  }

  return new Map((data || []).map(function (row) {
    return [row.id, String(row.category || "Unknown").toUpperCase()];
  }));
}

async function fetchPodiumBreakdowns(client, users, categoryByChallengeId) {
  if (!Array.isArray(users) || users.length < 1) {
    return {};
  }

  const userIds = users.map(function (user) {
    return user.id;
  }).filter(Boolean);
  if (userIds.length < 1) {
    return {};
  }

  const { data, error } = await client
    .from("solves")
    .select("user_id, challenge_id")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  const grouped = {};
  userIds.forEach(function (userId) {
    grouped[userId] = {};
  });

  (data || []).forEach(function (row) {
    const category = categoryByChallengeId.get(row.challenge_id) || "UNKNOWN";
    grouped[row.user_id][category] = (grouped[row.user_id][category] || 0) + 1;
  });

  return users.reduce(function (accumulator, user) {
    const categoryCounts = grouped[user.id] || {};
    const totalSolves = Object.values(categoryCounts).reduce(function (sum, count) {
      return sum + Number(count || 0);
    }, 0);
    const slices = Object.entries(categoryCounts).map(function ([label, count]) {
      return {
        label,
        count: Number(count || 0),
        color: getCategoryColor(label)
      };
    }).sort(function (left, right) {
      return right.count - left.count;
    });

    let runningPercent = 0;
    const gradient = slices.map(function (slice, index) {
      const start = runningPercent;
      const end = index === slices.length - 1 ? 100 : start + ((slice.count / totalSolves) * 100);
      runningPercent = end;
      return `${slice.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(", ");

    accumulator[user.id] = {
      totalSolves,
      gradient,
      slices
    };
    return accumulator;
  }, {});
}

// Page bootstrapper for the scoreboard route.
// Loads auth, fetches the first scoreboard page, then wires filters, search, infinite scroll, and realtime updates.
async function initScoreboardPage() {
  // Local state is enough here because the page is a single-route vanilla JS surface.
  const state = {
    auth: null,
    summary: null,
    allUsers: [],
    filteredUsers: [],
    loadedCount: 0,
    visibleCount: USERS_PAGE_SIZE,
    hasLoadedAll: false,
    isFetching: false,
    filter: "all",
    searchTerm: "",
    refreshTimer: null,
    podiumBreakdowns: {},
    challengeCategoryById: null
  };

  const bootNode = document.querySelector("[data-users-boot]");
  const bootCountNode = document.querySelector("[data-users-boot-count]");
  const totalCountNode = document.getElementById("users-total-count");
  const activeCountNode = document.getElementById("users-active-count");
  const solvesCountNode = document.getElementById("users-solvers-count");
  const topTenCountNode = document.getElementById("users-topten-count");
  const rankNode = document.querySelector("[data-users-rank]");
  const podiumNode = document.getElementById("users-podium");
  const podiumSection = podiumNode ? podiumNode.closest(".users-podium") : null;
  const gridNode = document.getElementById("users-grid");
  const loadingNode = document.getElementById("users-loading");
  const endStateNode = document.getElementById("users-end-state");
  const endCountNode = document.querySelector("[data-users-end-count]");
  const searchInput = document.getElementById("users-search-input");
  const sentinel = document.getElementById("users-sentinel");

  function setLoading(isLoading) {
    state.isFetching = isLoading;
    if (loadingNode) {
      loadingNode.hidden = !isLoading;
    }
  }

  function getFilteredUsers() {
    const searchTerm = state.searchTerm.trim().toLowerCase();
    return state.allUsers.filter(function (user) {
      if (state.filter === "active" && !user.active_in_last_24h) {
        return false;
      }

      if (state.filter === "top10" && user.rank > 10) {
        return false;
      }

      if (searchTerm && !String(user.username || "").toLowerCase().includes(searchTerm)) {
        return false;
      }

      return true;
    });
  }

  function renderMetrics() {
    if (!state.summary) {
      return;
    }

    applyCountUp(totalCountNode, state.summary.totalUsers);
    applyCountUp(activeCountNode, state.summary.activeUsers);
    applyCountUp(solvesCountNode, state.summary.usersWithSolves);
    applyCountUp(topTenCountNode, state.summary.topTenUsers);

    if (bootCountNode) {
      bootCountNode.textContent = Number(state.summary.totalUsers).toLocaleString("en-US");
    }

    if (rankNode) {
      rankNode.textContent = `#${Number(state.summary.userRank || 0).toLocaleString("en-US")}`;
    }

    if (endCountNode) {
      endCountNode.textContent = Number(state.summary.totalUsers).toLocaleString("en-US");
    }
  }

  function renderPodium() {
    if (!podiumNode) {
      return;
    }

    if (podiumSection) {
      podiumSection.hidden = Boolean(state.summary && state.summary.totalUsers === 0);
    }

    const podiumUsers = state.allUsers.slice(0, 3).map(function (user) {
      return {
        ...user,
        category_breakdown: state.podiumBreakdowns[user.id] || null
      };
    });
    podiumNode.innerHTML = [1, 2, 3].map(function (rank) {
      return createPodiumCard(podiumUsers[rank - 1], rank);
    }).join("");
    attachProfileLinks(podiumNode);
  }

  async function hydratePodiumBreakdowns() {
    const podiumUsers = state.allUsers.slice(0, 3);
    if (podiumUsers.length < 1) {
      state.podiumBreakdowns = {};
      renderPodium();
      return;
    }

    if (!state.challengeCategoryById) {
      state.challengeCategoryById = await fetchChallengeCategoryMap(requireSupabaseClient());
    }

    state.podiumBreakdowns = await fetchPodiumBreakdowns(requireSupabaseClient(), podiumUsers, state.challengeCategoryById);
    renderPodium();
  }

  function renderGrid() {
    // Search and pills filter client-side over the accumulated registry rows.
    if (!gridNode) {
      return;
    }

    state.filteredUsers = getFilteredUsers();
    const visibleUsers = state.filteredUsers.slice(0, state.visibleCount);
    gridNode.innerHTML = visibleUsers.map(function (user) {
      return createUserCard(user, state.auth?.user?.id);
    }).join("");
    attachProfileLinks(gridNode);

    if (endStateNode) {
      endStateNode.hidden = !(state.hasLoadedAll && state.filteredUsers.length > 0 && visibleUsers.length >= state.filteredUsers.length);
    }
  }

  async function loadNextPage() {
    // Infinite scroll appends another Supabase batch and rerenders the visible registry.
    if (state.isFetching || state.hasLoadedAll) {
      return;
    }

    setLoading(true);
    try {
      const page = await fetchUsersPage(requireSupabaseClient(), state.loadedCount, USERS_PAGE_SIZE);
      state.loadedCount += page.length;
      if (page.length < USERS_PAGE_SIZE) {
        state.hasLoadedAll = true;
      }

      state.allUsers = normalizeUsers(state.allUsers.concat(page));
      renderPodium();
      renderGrid();
    } finally {
      setLoading(false);
    }
  }

  async function ensureVisibleCoverage() {
    const topTenLimit = Math.min(state.summary?.topTenUsers || 0, 10);
    while (!state.isFetching && !state.hasLoadedAll && state.filteredUsers.length < state.visibleCount) {
      if (state.filter === "top10" && state.loadedCount >= topTenLimit) {
        break;
      }

      await loadNextPage();
    }
  }

  async function refreshDirectory() {
    // Realtime updates trigger a fresh summary plus a reset paginated fetch.
    state.loadedCount = 0;
    state.visibleCount = USERS_PAGE_SIZE;
    state.allUsers = [];
    state.filteredUsers = [];
    state.hasLoadedAll = false;
    state.podiumBreakdowns = {};
    renderPodium();
    renderGrid();
    state.summary = await fetchSummary(requireSupabaseClient(), state.auth.profile);
    renderMetrics();
    await loadNextPage();
    await hydratePodiumBreakdowns();
    await ensureVisibleCoverage();
  }

  function scheduleRealtimeRefresh() {
    if (state.refreshTimer) {
      window.clearTimeout(state.refreshTimer);
    }

    state.refreshTimer = window.setTimeout(function () {
      refreshDirectory().catch(function (error) {
        window.alert(error?.message || "Unable to refresh the user registry.");
      });
    }, 240);
  }

  try {
    state.auth = await requireAuth();
    if (!state.auth) {
      return;
    }

    populateAuthUI(state.auth.profile, state.auth.user);
    bindLogoutButtons();
    await refreshDirectory();

    window.setTimeout(function () {
      if (!bootNode) {
        return;
      }

      bootNode.classList.add("is-hidden");
      window.setTimeout(function () {
        bootNode.hidden = true;
      }, 360);
    }, 1000);

    setActiveFilter(state.filter);

    document.querySelectorAll(".users-filter").forEach(function (button) {
      button.addEventListener("click", async function () {
        const nextFilter = button.dataset.filter || "all";
        if (nextFilter === state.filter) {
          return;
        }

        state.filter = nextFilter;
        state.visibleCount = USERS_PAGE_SIZE;
        setActiveFilter(state.filter);
        renderGrid();
        await ensureVisibleCoverage();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", async function (event) {
        state.searchTerm = event.target.value || "";
        state.visibleCount = USERS_PAGE_SIZE;
        renderGrid();
        await ensureVisibleCoverage();
      });
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        if (state.filteredUsers.length > state.visibleCount) {
          state.visibleCount += USERS_PAGE_SIZE;
          renderGrid();
          return;
        }

        loadNextPage().catch(function (error) {
          window.alert(error?.message || "Unable to load more users.");
        });
      });
    }, {
      rootMargin: "0px 0px 240px 0px"
    });

    if (sentinel) {
      observer.observe(sentinel);
    }

    const channel = requireSupabaseClient().channel("users_directory_changes");
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, function (payload) {
        // The current viewer's cached profile is updated immediately so navbar text stays consistent.
        if (payload?.new?.id && payload.new.id === state.auth.user.id) {
          state.auth.profile = { ...state.auth.profile, ...payload.new };
          populateAuthUI(state.auth.profile, state.auth.user);
        }

        scheduleRealtimeRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "solves" }, function () {
        // A solve can change ranking, solves_count, and active details even if the user row itself does not change.
        scheduleRealtimeRefresh();
      })
      .subscribe();

    const displayUsername = getDisplayUsername(state.auth.profile, state.auth.user);
    if (!state.summary?.userRank && displayUsername && rankNode) {
      rankNode.textContent = "#0";
    }
  } catch (error) {
    if (bootNode) {
      bootNode.hidden = true;
    }
    window.alert(error?.message || "Unable to initialize the users page.");
  }
}

initScoreboardPage();
