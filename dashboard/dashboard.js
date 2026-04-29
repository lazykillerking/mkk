import { bindLogoutButtons, getDisplayUsername, populateAuthUI, requireAuth } from "/js/session.js";
import { requireSupabaseClient } from "/js/supabase.js";

const supabase = requireSupabaseClient();

// State
let currentUser = null;
let currentUserId = null;
let currentUsername = null;
let currentProfile = null;
let refreshTimer = null;

function getNode(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = getNode(id);
  if (node) {
    node.innerText = value;
  }
}

function setSectionError(elementId) {
  const el = getNode(elementId);
  if (el) {
    el.innerHTML = '<div class="empty-state">&gt; data unavailable</div>';
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Format relative time using friendlier labels for the personal activity feed.
function getRelativeTime(timestamp) {
  const diffInMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(diffInMs) || diffInMs < 0) {
    return 'now';
  }

  const diffInSeconds = Math.floor(diffInMs / 1000);
  if (diffInSeconds < 60) {
    return 'now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 min ago' : `${diffInMinutes} mins ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hr ago' : `${diffInHours} hrs ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
}

function refreshFeedTimes() {
  document.querySelectorAll('#live-feed [data-solved-at]').forEach((row) => {
    const timeNode = row.querySelector('.feed-time');
    if (timeNode) {
      timeNode.textContent = getRelativeTime(row.dataset.solvedAt);
    }
  });
}

async function initDashboard() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    currentUser = auth.user;
    currentUserId = auth.user.id;
    currentProfile = auth.profile;
    currentUsername = getDisplayUsername(auth.profile, auth.user);

    populateAuthUI(auth.profile, auth.user);
    bindLogoutButtons();

    renderPersonalWelcome();
    await loadDashboardData();
    subscribeDashboardUpdates();
  } catch (error) {
    window.alert(error?.message || "Unable to initialize the dashboard.");
  }
}

async function loadDashboardData() {
  // Query 1 & 10: counts from users
  const qUsers = supabase.from('users').select('*', { count: 'exact', head: true });
  // Query 2: count challenges
  const qChallenges = supabase.from('challenges').select('*', { count: 'exact', head: true });
  // Query 3: count solves
  const qSolvesCount = supabase.from('solves').select('*', { count: 'exact', head: true });
  
  // Query 4: first bloods (earliest solve per challenge)
  const qBloods = supabase.from('solves').select('challenge_id, user_id, solved_at').order('solved_at', { ascending: true });
  
  // Query 5: leading player
  const qLeader = supabase.from('user_rankings').select('username, score').order('rank', { ascending: true }).limit(1);
  
  // Query 6: top 3 scoreboard
  const qTop3 = supabase.from('user_rankings').select('id, username, score').order('rank', { ascending: true }).limit(3);
  
  // Query 8: current user's solve activity
  const qActivity = currentUserId
    ? supabase.from('solves')
      .select(`
        id,
        solved_at,
        challenge_id,
        user_id,
        users (username),
        challenges (title, points)
      `)
      .eq('user_id', currentUserId)
      .order('solved_at', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] });

  // Query 9: categories
  const qCategories = supabase.from('challenges').select('category');

  // Run independent queries
  const results = await Promise.allSettled([
    qUsers, qChallenges, qSolvesCount, qBloods, qLeader, qTop3, qActivity, qCategories
  ]);
    
  // Users count (Query 1 & 10)
  if (results[0].status === 'fulfilled' && !results[0].value.error) {
    const count = results[0].value.count || 0;
    setText('boot-online', count);
    setText('pulse-online', count);
    setText('stats-registered', count);
  } else {
    setText('boot-online', '--');
    setText('pulse-online', '--');
    setText('stats-registered', '--');
  }
    
  // Challenges count (Query 2)
  if (results[1].status === 'fulfilled' && !results[1].value.error) {
    const count = results[1].value.count || 0;
    setText('boot-challenges', count);
    setText('pulse-total-challenges', count);
  } else {
    setText('boot-challenges', '--');
    setText('pulse-total-challenges', '--');
  }
    
  // Solves count (Query 3)
  if (results[2].status === 'fulfilled' && !results[2].value.error) {
    const count = results[2].value.count || 0;
    setText('pulse-total-solves', count);
    setText('stats-solves', count);
  } else {
    setText('pulse-total-solves', '--');
    setText('stats-solves', '--');
  }
    
    // First bloods (Query 4)
    let bloods = new Map();
    if (results[3].status === 'fulfilled' && !results[3].value.error) {
      const data = results[3].value.data || [];
      for (const row of data) {
        if (!bloods.has(row.challenge_id)) {
          bloods.set(row.challenge_id, {
            user_id: row.user_id,
            solved_at: row.solved_at
          });
        }
      }
      setText('pulse-bloods', bloods.size);
      setText('stats-bloods', bloods.size);
    } else {
      setText('pulse-bloods', '--');
      setText('stats-bloods', '--');
    }
    
    // Leader (Query 5)
    if (results[4].status === 'fulfilled' && !results[4].value.error) {
      if (results[4].value.data && results[4].value.data.length > 0) {
        setText('pulse-leader', results[4].value.data[0].username);
      } else {
        setText('pulse-leader', 'no leader yet');
      }
    } else {
      setText('pulse-leader', 'unavailable');
    }
    
    // Top 3 (Query 6)
    if (results[5].status === 'fulfilled' && !results[5].value.error) {
      const data = results[5].value.data || [];
      const container = getNode('mini-standings');
      
      if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">&gt; no players yet</div>';
      } else {
        container.innerHTML = '';
        data.forEach((user, idx) => {
          const isMe = currentUserId && user.id === currentUserId;
          const row = document.createElement('div');
          row.className = `standing-row ${isMe ? 'is-current-user' : ''}`;
          row.innerHTML = `
            <span class="rank-pos">#${idx + 1}</span>
            <span class="user-name">${escapeHtml(user.username)}${isMe ? '<span class="you-indicator">&larr; you</span>' : ''}</span>
            <span class="user-score">${Number(user.score || 0).toLocaleString("en-US")}</span>
          `;
          container.appendChild(row);
        });
      }
    } else {
      setSectionError('mini-standings');
    }
    
    // Activity feed (Query 8)
    if (results[6].status === 'fulfilled' && !results[6].value.error) {
      const data = results[6].value.data || [];
      const container = getNode('live-feed');
      
      if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">&gt; no challenges solved yet</div>';
      } else {
        container.innerHTML = '';
        data.forEach(solve => {
          renderFeedRow(container, solve, false);
        });
        refreshFeedTimes();
      }
    } else {
      setSectionError('live-feed');
    }
    
    // Categories (Query 9)
    if (results[7].status === 'fulfilled' && !results[7].value.error) {
      const data = results[7].value.data || [];
      const container = getNode('category-pills-container');
      
      if (data.length === 0) {
        container.innerHTML = '';
      } else {
        // distinct categories
        const cats = [...new Set(data.map(c => c.category).filter(Boolean))];
        container.innerHTML = '';
        cats.forEach(c => {
          const a = document.createElement('a');
          a.href = '/challenges';
          a.className = 'category-pill';
          a.innerText = c;
          container.appendChild(a);
        });
      }
    } else {
      setSectionError('category-pills-container');
    }

  renderPersonalWelcome();
}

function renderPersonalWelcome() {
  const welcomeEl = getNode('personal-welcome');
  if (!welcomeEl) {
    return;
  }

  if (!currentUser) {
    welcomeEl.innerHTML = '&gt; register to compete';
    welcomeEl.setAttribute('href', '/register');
    return;
  }

  const displayName = currentUsername || getDisplayUsername(currentProfile, currentUser);
  welcomeEl.innerHTML = `&gt; good luck out there, <span class="username">${escapeHtml(displayName)}</span>`;
  welcomeEl.setAttribute('href', '/challenges');
}

function bumpMetric(id) {
  const node = getNode(id);
  if (!node || node.innerText === '--') {
    return;
  }

  const currentValue = Number.parseInt(node.innerText.replace(/,/g, ""), 10);
  if (Number.isFinite(currentValue)) {
    node.innerText = Number(currentValue + 1).toLocaleString("en-US");
  }
}

function scheduleDashboardRefresh() {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }

  refreshTimer = window.setTimeout(function () {
    loadDashboardData().catch(function (error) {
      console.error("Unable to refresh dashboard data", error);
    });
  }, 300);
}

function subscribeDashboardUpdates() {
  supabase.channel('dashboard_system_feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solves' }, async (payload) => {
      const newSolve = payload.new;

      bumpMetric('pulse-total-solves');
      bumpMetric('stats-solves');
      scheduleDashboardRefresh();

      if (!currentUserId || newSolve.user_id !== currentUserId) {
        return;
      }
      
      // Fetch details for the new solve to display in the current user's feed.
      try {
        const { data } = await supabase
          .from('solves')
          .select(`
            id,
            solved_at,
            challenge_id,
            user_id,
            users (username),
            challenges (title, points)
          `)
          .eq('id', newSolve.id)
          .single();
          
        if (data) {
          const container = getNode('live-feed');
          if (container) {
            // First time it gets a solve, remove empty state
            if (container.querySelector('.empty-state') || container.querySelector('.skeleton-text')) {
              container.innerHTML = '';
            }

            renderFeedRow(container, data, true);
            refreshFeedTimes();
            
            if (container.children.length > 20) {
              container.removeChild(container.lastChild);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching new solve details', err);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUserId}` }, (payload) => {
      currentProfile = { ...currentProfile, ...payload.new };
      currentUsername = getDisplayUsername(currentProfile, currentUser);
      populateAuthUI(currentProfile, currentUser);
      renderPersonalWelcome();
      scheduleDashboardRefresh();
    })
    .subscribe();
}

function renderFeedRow(container, solve, animate = false) {
  const row = document.createElement('div');
  
  const username = solve.users?.username || currentUsername || 'unknown';
  const cTitle = solve.challenges?.title || 'unknown';
  const cPts = solve.challenges?.points || '0';
  const timeStr = getRelativeTime(solve.solved_at);
  row.className = 'feed-row is-current-user';
  row.dataset.solvedAt = solve.solved_at;
  if (animate) {
    row.classList.add('feed-row--incoming'); // Assuming this class exists in animations.css for newly added rows
  }

  row.innerHTML = `
    <span class="feed-icon">✔</span>
    <span class="feed-user">${escapeHtml(username)}</span>
    <span class="feed-arrow">&rarr;</span>
    <span class="feed-challenge">${escapeHtml(cTitle)}</span>
    <span class="feed-pts">+${Number(cPts || 0).toLocaleString("en-US")}</span>
    <span class="feed-time">${timeStr}</span>
  `;
  
  if (animate && container.firstChild) {
    container.insertBefore(row, container.firstChild);
  } else {
    container.appendChild(row);
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
window.setInterval(refreshFeedTimes, 30000);
