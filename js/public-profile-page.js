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

    const { data: profileData, error: profileError } = await client
      .from("users")
      .select("id, username, created_at, score, about")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profileData) {
      showError(`User "${username}" not found.`);
      return;
    }

    const { data: rankingData, error: rankingError } = await client
      .from("user_rankings")
      .select("score, solves_count, rank, joined_ago")
      .eq("username", username)
      .maybeSingle();

    if (rankingError) {
      throw rankingError;
    }

    const data = {
      username: profileData.username,
      created_at: profileData.created_at,
      about: profileData.about,
      score: rankingData?.score ?? profileData.score,
      solves_count: rankingData?.solves_count ?? 0,
      rank: rankingData?.rank ?? 0,
      joined_ago: rankingData?.joined_ago || "joined recently"
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

    if (heroPts) heroPts.textContent = scoreText;
    if (heroRank) heroRank.textContent = rankText;
    if (heroSolves) heroSolves.textContent = solvesText;
    if (tileScore) tileScore.textContent = scoreText;
    if (tileRank) tileRank.textContent = rankText;
    if (tileRate) tileRate.textContent = data.solves_count > 0 ? `${Math.min(100, Math.round(data.solves_count * 12))}%` : "0%";
    if (tileStreak) tileStreak.textContent = "—";
    if (cardScore) cardScore.textContent = scoreText;
    if (cardRank) cardRank.textContent = rankText;
    if (cardSolves) cardSolves.textContent = solvesText;

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

initPublicProfilePage();
