import { requireSupabaseClient } from "/js/supabase.js";

const supabase = requireSupabaseClient();

// State
let currentUser = null;
let currentUserId = null;
let currentUsername = null;
let currentUserScore = 0;

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

// Error handlers for sections
function setSectionError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = '<div class="empty-state">&gt; data unavailable</div>';
  }
}

async function initDashboard() {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData && authData.user) {
      currentUser = authData.user;
      currentUserId = authData.user.id;
      
      const { data: userData } = await supabase
        .from('users')
        .select('username, score')
        .eq('id', currentUserId)
        .single();
        
      if (userData) {
        currentUsername = userData.username;
        currentUserScore = userData.score || 0;
        
        const welcomeEl = document.getElementById('personal-welcome');
        if (welcomeEl) {
          welcomeEl.innerHTML = `&gt; good luck out there, <span class="username">${currentUsername}</span>`;
          welcomeEl.removeAttribute('href');
        }
      }
    } else {
      const welcomeEl = document.getElementById('personal-welcome');
      if (welcomeEl) {
        welcomeEl.innerHTML = '&gt; register to compete';
        welcomeEl.setAttribute('href', '/register');
      }
    }
  } catch(e) {
    console.error('Auth error', e);
  }

  // Query 1 & 10: counts from users
  const qUsers = supabase.from('users').select('*', { count: 'exact', head: true });
  // Query 2: count challenges
  const qChallenges = supabase.from('challenges').select('*', { count: 'exact', head: true });
  // Query 3: count solves
  const qSolvesCount = supabase.from('solves').select('*', { count: 'exact', head: true });
  
  // Query 4: first bloods (earliest solve per challenge)
  const qBloods = supabase.from('solves').select('challenge_id, user_id, solved_at').order('solved_at', { ascending: true });
  
  // Query 5: leading player
  const qLeader = supabase.from('users').select('username, score').order('score', { ascending: false }).limit(1);
  
  // Query 6: top 3 scoreboard
  const qTop3 = supabase.from('users').select('username, score').order('score', { ascending: false }).limit(3);
  
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
  Promise.allSettled([
    qUsers, qChallenges, qSolvesCount, qBloods, qLeader, qTop3, qActivity, qCategories
  ]).then(async (results) => {
    
    // Users count (Query 1 & 10)
    if (results[0].status === 'fulfilled' && !results[0].value.error) {
      const count = results[0].value.count || 0;
      document.getElementById('boot-online').innerText = count;
      document.getElementById('pulse-online').innerText = count;
      document.getElementById('stats-registered').innerText = count;
    } else {
      document.getElementById('boot-online').innerText = '--';
      document.getElementById('pulse-online').innerText = '--';
      document.getElementById('stats-registered').innerText = '--';
    }
    
    // Challenges count (Query 2)
    if (results[1].status === 'fulfilled' && !results[1].value.error) {
      const count = results[1].value.count || 0;
      document.getElementById('boot-challenges').innerText = count;
      document.getElementById('pulse-total-challenges').innerText = count;
    } else {
      document.getElementById('boot-challenges').innerText = '--';
      document.getElementById('pulse-total-challenges').innerText = '--';
    }
    
    // Solves count (Query 3)
    if (results[2].status === 'fulfilled' && !results[2].value.error) {
      const count = results[2].value.count || 0;
      document.getElementById('pulse-total-solves').innerText = count;
      document.getElementById('stats-solves').innerText = count;
    } else {
      document.getElementById('pulse-total-solves').innerText = '--';
      document.getElementById('stats-solves').innerText = '--';
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
      document.getElementById('pulse-bloods').innerText = bloods.size;
      document.getElementById('stats-bloods').innerText = bloods.size;
    } else {
      document.getElementById('pulse-bloods').innerText = '--';
      document.getElementById('stats-bloods').innerText = '--';
    }
    
    // Leader (Query 5)
    if (results[4].status === 'fulfilled' && !results[4].value.error) {
      if (results[4].value.data && results[4].value.data.length > 0) {
        document.getElementById('pulse-leader').innerText = results[4].value.data[0].username;
      } else {
        document.getElementById('pulse-leader').innerText = 'no leader yet';
      }
    } else {
      document.getElementById('pulse-leader').innerText = 'unavailable';
    }
    
    // Top 3 (Query 6)
    if (results[5].status === 'fulfilled' && !results[5].value.error) {
      const data = results[5].value.data || [];
      const container = document.getElementById('mini-standings');
      
      if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">&gt; no players yet</div>';
      } else {
        container.innerHTML = '';
        data.forEach((user, idx) => {
          const isMe = currentUsername && user.username === currentUsername;
          const row = document.createElement('div');
          row.className = `standing-row ${isMe ? 'is-current-user' : ''}`;
          row.innerHTML = `
            <span class="rank-pos">#${idx + 1}</span>
            <span class="user-name">${user.username}${isMe ? '<span class="you-indicator">&larr; you</span>' : ''}</span>
            <span class="user-score">${user.score}</span>
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
      const container = document.getElementById('live-feed');
      
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
      const container = document.getElementById('category-pills-container');
      
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

  });
  
  // Real-time updates for solves
  supabase.channel('solves_feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solves' }, async (payload) => {
      const newSolve = payload.new;

      if (!currentUserId || newSolve.user_id !== currentUserId) {
        return;
      }
      
      // Update counts incrementally
      const countEl = document.getElementById('pulse-total-solves');
      const statsEl = document.getElementById('stats-solves');
      if (countEl && countEl.innerText !== '--') countEl.innerText = parseInt(countEl.innerText) + 1;
      if (statsEl && statsEl.innerText !== '--') statsEl.innerText = parseInt(statsEl.innerText) + 1;
      
      // Fetch details for the new solve to display in feed
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
          const container = document.getElementById('live-feed');
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
    .subscribe();
}

function renderFeedRow(container, solve, animate = false) {
  const row = document.createElement('div');
  
  const username = solve.users?.username || 'unknown';
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
    <span class="feed-user">${username}</span>
    <span class="feed-arrow">&rarr;</span>
    <span class="feed-challenge">${cTitle}</span>
    <span class="feed-pts">+${cPts}</span>
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
