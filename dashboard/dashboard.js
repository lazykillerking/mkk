import { requireSupabaseClient } from "/js/supabase.js";

const supabase = requireSupabaseClient();

// State
let currentUser = null;
let currentUserId = null;
let currentUsername = null;
let currentUserScore = 0;

// Format relative time (e.g. "2m ago")
function getRelativeTime(timestamp) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffInMs = new Date(timestamp) - new Date();
  const diffInMinutes = Math.round(diffInMs / (1000 * 60));
  
  if (Math.abs(diffInMinutes) < 60) {
    if (diffInMinutes === 0) return 'just now';
    return `${Math.abs(diffInMinutes)}m ago`;
  }
  
  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return `${Math.abs(diffInHours)}h ago`;
  }
  
  const diffInDays = Math.round(diffInHours / 24);
  return `${Math.abs(diffInDays)}d ago`;
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
  
  // Query 8: global activity feed
  const qActivity = supabase.from('solves')
    .select(`
      solved_at,
      challenge_id,
      users (username),
      challenges (title, points)
    `)
    .order('solved_at', { ascending: false })
    .limit(20);

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
        container.innerHTML = '<div class="empty-state">&gt; no activity yet</div>';
      } else {
        container.innerHTML = '';
        data.forEach(solve => {
          renderFeedRow(container, solve, bloods, false);
        });
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
            solved_at,
            challenge_id,
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
            
            // Check if this might be a first blood by checking if it already exists globally
            // Note: Since we only loaded first bloods once on page load, a real app would check properly, 
            // but we'll approximate based on what we fetched, or fetch again.
            // For simplicity, we fetch the challenge's earliest solve to see if it's this one.
            const { data: earliest } = await supabase
              .from('solves')
              .select('id')
              .eq('challenge_id', newSolve.challenge_id)
              .order('solved_at', { ascending: true })
              .limit(1)
              .single();
              
            let isBlood = false;
            if (earliest && earliest.id === newSolve.id) {
              isBlood = true;
              const bloodCountEl = document.getElementById('pulse-bloods');
              const bloodStatsEl = document.getElementById('stats-bloods');
              if (bloodCountEl && bloodCountEl.innerText !== '--') bloodCountEl.innerText = parseInt(bloodCountEl.innerText) + 1;
              if (bloodStatsEl && bloodStatsEl.innerText !== '--') bloodStatsEl.innerText = parseInt(bloodStatsEl.innerText) + 1;
            }
            
            renderFeedRow(container, data, null, true, isBlood);
            
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

function renderFeedRow(container, solve, bloodsMap, animate = false, overrideIsBlood = false) {
  const row = document.createElement('div');
  
  const username = solve.users?.username || 'unknown';
  const cTitle = solve.challenges?.title || 'unknown';
  const cPts = solve.challenges?.points || '0';
  const timeStr = getRelativeTime(solve.solved_at);
  const isMe = currentUsername && username === currentUsername;
  
  let isBlood = overrideIsBlood;
  if (!overrideIsBlood && bloodsMap) {
    const bInfo = bloodsMap.get(solve.challenge_id);
    if (bInfo && bInfo.solved_at === solve.solved_at) {
      isBlood = true;
    }
  }
  
  row.className = `feed-row ${isMe ? 'is-current-user' : ''}`;
  if (animate) {
    row.classList.add('feed-row--incoming'); // Assuming this class exists in animations.css for newly added rows
  }

  const iconHtml = isBlood 
    ? `<span class="feed-icon blood-icon">⚡</span>`
    : `<span class="feed-icon">✔</span>`;

  row.innerHTML = `
    ${iconHtml}
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
