import { getUserStats } from "./stats.js";
import { requireSupabaseClient } from "./supabase.js";

// Public profile viewer.
// This page is view-only and loads arbitrary usernames from the query string.
// It reuses the visual theme from /profile/ while excluding edit functionality.
function getRequestedUsername() {
  const params = new URLSearchParams(window.location.search);
  let username = params.get("username")?.trim();
  if (username) {
    return username;
  }

  const raw = window.location.search.replace(/^\?/, "");
  if (raw && !raw.includes("=")) {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  }

  return "";
}

function setNodeText(selector, value) {
  const node = document.querySelector(selector);
  if (!node) {
    return;
  }

  node.textContent = value;
}

function bindCopyCard() {
  const copyButton = document.getElementById("copy-card-button");
  const hackerCard = document.getElementById("hacker-card");
  if (!copyButton || !hackerCard) {
    return;
  }

  copyButton.addEventListener("click", async () => {
    if (typeof window.html2canvas !== "function") {
      return;
    }

    const originalLabel = copyButton.textContent;
    copyButton.disabled = true;

    try {
      const canvas = await window.html2canvas(hackerCard, {
        backgroundColor: "#080c14",
        scale: 2,
        useCORS: true,
        logging: false
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error("PNG export failed");
      }
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      copyButton.textContent = "Copied ✓";
    } catch (error) {
      copyButton.textContent = "Copy failed";
    }

    window.setTimeout(() => {
      copyButton.textContent = originalLabel;
      copyButton.disabled = false;
    }, 1500);
  });
}

function renderCategoryCard(stats) {
  const barsContainer = document.getElementById("category-bars");
  const radarContainer = document.getElementById("radar-pane");
  if (!barsContainer || !radarContainer) return;

  // Build bars
  let barsHtml = "";
  const topCats = stats.categoryStats.slice(0, 5);
  topCats.forEach(cat => {
    const cls = cat.percent > 70 ? " bar-fill--strong" : "";
    barsHtml += `
      <div class="performance-row">
        <div class="performance-labels"><span>${cat.label}</span><span>${cat.percent}% <span class="performance-note">(${cat.count} solve${cat.count === 1 ? '' : 's'})</span></span></div>
        <div class="bar-track"><span class="bar-fill${cls}" data-bar-width="${cat.percent}" data-animate-on-scroll></span></div>
      </div>`;
  });
  barsContainer.innerHTML = barsHtml;

  // Mini card bars in hero
  const mini = document.getElementById("hacker-card-mini");
  if (mini && topCats.length > 0) {
    mini.innerHTML = `
      <div class="hacker-card__mini-label">${topCats[0].label} Main</div>
      <div class="bar-track"><span class="bar-fill bar-fill--cyan" style="width: ${topCats[0].percent}%"></span></div>
    `;
  }

  // Build SVG Radar
  const N = topCats.length > 2 ? topCats.length : 5;
  // Fallback to 5 edges if not enough varied categories exist yet
  const renderCats = topCats.length === N ? topCats : [
    { label: "WEB", percent: 0 }, { label: "FORENSICS", percent: 0 }, { label: "CRYPTO", percent: 0 }, { label: "REVERSE", percent: 0 }, { label: "OSINT", percent: 0 }
  ];

  let svg = '<svg class="radar-chart" viewBox="0 0 220 220" role="img" aria-label="Category radar chart">';
  svg += '<g transform="translate(110 110)">';
  const getPoints = (scale) => {
    let pts = [];
    const r = 80 * scale;
    for (let i = 0; i < N; i++) {
      const angle = (i * 2 * Math.PI / N) - Math.PI / 2;
      pts.push(`${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`);
    }
    return pts.join(" ");
  };
  svg += `<polygon points="${getPoints(1)}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"></polygon>`;
  svg += `<polygon points="${getPoints(0.6)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"></polygon>`;

  let dataPtsArray = [];
  let dots = "";
  for (let i = 0; i < N; i++) {
    const angle = (i * 2 * Math.PI / N) - Math.PI / 2;
    // Axes
    const ax = (Math.cos(angle) * 80).toFixed(2);
    const ay = (Math.sin(angle) * 80).toFixed(2);
    svg += `<line x1="0" y1="0" x2="${ax}" y2="${ay}" stroke="rgba(255,255,255,0.12)" stroke-width="1"></line>`;
    // Labels
    const tx = (Math.cos(angle) * 92).toFixed(2);
    const ty = (Math.sin(angle) * 92 + 4).toFixed(2);
    let anchor = "middle";
    if (tx > 15) anchor = "start";
    else if (tx < -15) anchor = "end";
    svg += `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="11px" fill="#fff" opacity="0.8">${renderCats[i].label}</text>`;

    // Data
    const p = renderCats[i].percent / 100;
    const px = (Math.cos(angle) * 80 * p);
    const py = (Math.sin(angle) * 80 * p);
    dataPtsArray.push(`${px.toFixed(2)},${py.toFixed(2)}`);
    dots += `<circle class="radar-dot" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3"><title>${renderCats[i].label} ${renderCats[i].percent}%</title></circle>`;
  }

  svg += `<polygon points="${dataPtsArray.join(" ")}" fill="rgba(0,229,255,0.12)" stroke="rgba(0,229,255,0.7)" stroke-width="1.5" filter="drop-shadow(0 0 12px rgba(0,229,255,0.24))"></polygon>`;
  svg += dots;
  svg += '</g></svg>';
  radarContainer.innerHTML = svg;
}

function bindScrollBars() {
  const scrollBars = Array.from(document.querySelectorAll("[data-animate-on-scroll]"));
  scrollBars.forEach((bar) => {
    bar.classList.remove("is-animating");
    bar.classList.remove("is-scroll-active");
    bar.style.width = "0";
  });

  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const bar = entry.target;
      bar.style.setProperty("--bar-target", bar.dataset.barWidth + "%");
      bar.classList.add("is-scroll-active");
      bar.classList.remove("is-animating");
      void bar.offsetWidth;
      bar.classList.add("is-animating");
      instance.unobserve(bar);
    });
  }, { threshold: 0.35 });

  scrollBars.forEach((bar) => observer.observe(bar));
}

// Shows a lightweight page-level error and hides the profile content.
function showError(message) {
  const errorNode = document.getElementById("profile-not-found");
  const profileMain = document.querySelector(".profile-main");

  if (profileMain) {
    profileMain.hidden = true;
  }

  if (errorNode) {
    errorNode.hidden = false;
    errorNode.querySelector("p").textContent = message;
  }

  document.body.classList.remove("is-loading");
}

// Bootstrap the public profile page by resolving the requested username and loading the matching row.
async function initPublicProfilePage() {
  const username = getRequestedUsername();
  if (!username) {
    showError("No username provided. Use /users?username=USERNAME to view a public profile.");
    return;
  }

  try {
    const client = requireSupabaseClient();

    // Query the rankings view for identity and computed points/solves
    // We use ilike to be case-insensitive, and user_rankings bypasses the RLS restrictions
    const { data: profileData, error: profileError } = await client
      .from("user_rankings")
      .select("id, username, created_at, about, score, solves_count, rank, joined_ago")
      .ilike("username", username)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profileData) {
      showError(`User "${username}" not found.`);
      return;
    }

    const data = {
      username: profileData.username,
      created_at: profileData.created_at,
      about: profileData.about,
      score: profileData.score || 0,
      solves_count: profileData.solves_count || 0,
      rank: profileData.rank || 0,
      joined_ago: profileData.joined_ago || "joined recently"
    };

    setNodeText("[data-profile-username]", data.username);
    setNodeText("[data-profile-created-at]", `CTF Player · ${data.joined_ago}`);
    setNodeText("[data-profile-card-username]", data.username);
    setNodeText("[data-profile-card-bio]", data.about || "no bio set...");
    setNodeText("[data-profile-about]", data.about || "no bio set...");

    const heroPts = document.getElementById("hero-pts");
    const heroRank = document.getElementById("hero-rank");
    const heroSolves = document.getElementById("hero-solves");
    const cardScore = document.getElementById("card-score");
    const cardRank = document.getElementById("card-rank");
    const cardSolves = document.getElementById("card-solves");
    const tileScore = document.getElementById("tile-score");
    const tileRank = document.getElementById("tile-rank");
    const tileRate = document.getElementById("tile-rate");
    const tileStreak = document.getElementById("tile-streak");

    const scoreText = Number(data.score || 0).toLocaleString("en-US");
    const rankText = Number(data.rank || 0).toLocaleString("en-US");
    const solvesText = Number(data.solves_count || 0).toLocaleString("en-US");

    if (heroPts) {
      heroPts.textContent = scoreText;
      heroPts.dataset.countup = String(data.score || 0);
      heroPts.setAttribute("data-countup", String(data.score || 0));
    }
    if (heroRank) {
      heroRank.textContent = rankText;
      heroRank.dataset.countup = String(data.rank || 0);
      heroRank.setAttribute("data-countup", String(data.rank || 0));
    }
    if (heroSolves) {
      heroSolves.textContent = solvesText;
      heroSolves.dataset.countup = String(data.solves_count || 0);
      heroSolves.setAttribute("data-countup", String(data.solves_count || 0));
    }
    if (tileScore) tileScore.textContent = scoreText;
    if (tileRank) tileRank.textContent = rankText;
    
    // Fetch solves and challenges for category breakdown
    const { data: solvesData } = await client
      .from("solves")
      .select("challenge_id, solved_at")
      .eq("user_id", profileData.id);
      
    const { data: challengesData } = await client
      .from("challenges")
      .select("id, title, category, points");

    const backendSolves = (solvesData || []).map(row => ({
      id: row.challenge_id,
      timestamp: row.solved_at
    }));
    
    const allChallenges = (challengesData || []).map(row => ({
      id: row.id,
      name: row.title,
      category: row.category,
      points: row.points
    }));

    const stats = getUserStats(backendSolves, allChallenges);

    if (tileRate) tileRate.textContent = stats.solveRate + "%";
    if (tileStreak) tileStreak.textContent = stats.bestStreak;
    if (cardScore) cardScore.textContent = scoreText;
    if (cardRank) cardRank.textContent = rankText;
    if (cardSolves) cardSolves.textContent = solvesText;

    renderCategoryCard(stats);
    bindScrollBars();

    document.title = `${data.username} · MKK Profile`;
    document.body.classList.remove("is-loading");

    window.requestAnimationFrame(() => {
      [heroPts, heroRank, heroSolves, tileScore, tileRank].forEach(function (node) {
        if (node && typeof window.runCountUp === "function") {
          window.runCountUp(node);
        }
      });
    });
  } catch (error) {
    showError(error?.message || "Unable to load the public profile.");
  }
}

bindCopyCard();
initPublicProfilePage();
