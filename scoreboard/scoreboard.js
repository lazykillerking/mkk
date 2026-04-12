/**
 * scoreboard.js — Scoreboard-specific interactivity
 *
 * Handles:
 *  1. Building the full standings table from hardcoded data
 *  2. Sort pill switching (Score / Solves / First Bloods)
 *  3. Column-header click sorting with direction toggle
 *  4. Search filtering (hides non-matching rows; current user always visible)
 *  5. Animated row reorder (fade-out → reorder DOM → fade-in)
 */

(function () {
  "use strict";

  /* ─── Hardcoded dataset ─────────────────────────────────────────── */
  const CURRENT_USER = "lazykillerking";

  const PLAYERS = [
    { username: "rootphantom",    score: 5420, solves: 32, bloods: 4, joined: "Mar 2026" },
    { username: "nullspectre",    score: 5100, solves: 28, bloods: 2, joined: "Mar 2026" },
    { username: "lazykillerking",score: 1234, solves: 14, bloods: 2, joined: "Mar 2026" },
    { username: "bytewitch",      score: 1180, solves: 13, bloods: 1, joined: "Mar 2026" },
    { username: "hexnomad",       score: 1020, solves: 11, bloods: 0, joined: "Mar 2026" },
    { username: "packetghost",    score:  880, solves:  9, bloods: 1, joined: "Mar 2026" },
    { username: "shellmancer",    score:  740, solves:  8, bloods: 0, joined: "Mar 2026" },
    { username: "qbitqueen",      score:  620, solves:  7, bloods: 1, joined: "Mar 2026" },
    { username: "voidrunner",     score:  510, solves:  6, bloods: 0, joined: "Mar 2026" },
    { username: "cryptlurk",      score:  380, solves:  4, bloods: 0, joined: "Mar 2026" },
    { username: "kernelpanic",    score:  260, solves:  3, bloods: 0, joined: "Mar 2026" },
    { username: "nullbyte99",     score:  180, solves:  2, bloods: 0, joined: "Mar 2026" },
  ];

  /* ─── State ─────────────────────────────────────────────────────── */
  let sortKey = "score";      // "score" | "solves" | "bloods"
  let sortDir = "desc";       // "asc" | "desc"
  let searchQuery = "";

  /* Sort initial data */
  let tableData = PLAYERS.slice().sort((a, b) => b.score - a.score);

  /* ─── DOM refs ──────────────────────────────────────────────────── */
  const tbody        = document.getElementById("sb-tbody");
  const searchInput  = document.getElementById("sb-search");
  const sortPills    = document.querySelectorAll(".sb-pill");
  const thScore      = document.getElementById("th-score");
  const thSolves     = document.getElementById("th-solves");
  const thBloods     = document.getElementById("th-bloods");
  const colHeaders   = [thScore, thSolves, thBloods];

  /* Map pill data-sort values to dataset keys */
  const SORT_KEY_MAP = {
    score:  "score",
    solves: "solves",
    bloods: "bloods",
  };

  /* Map th data-col to dataset keys */
  const TH_KEY_MAP = {
    score:  "score",
    solves: "solves",
    bloods: "bloods",
  };

  /* ─── Helpers ───────────────────────────────────────────────────── */

  /** Sort the dataset in-place by current sortKey and sortDir */
  function applySortToData() {
    tableData.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }

  /** Format a number with commas */
  function fmt(n) {
    return Number(n).toLocaleString();
  }

  /** Build a single <tr> element (display:grid) */
  function buildRow(player, rank) {
    const isMe = player.username === CURRENT_USER;

    const tr = document.createElement("tr");
    tr.className = "sb-tr" + (isMe ? " sb-tr--me" : "");
    tr.dataset.username = player.username;
    tr.style.cursor = "pointer";

    const bloodsHtml = player.bloods > 0
      ? `<span class="sb-bloods sb-bloods--on">⚡ ${player.bloods}</span>`
      : `<span class="sb-bloods sb-bloods--off">—</span>`;

    tr.innerHTML = `
      <td class="sb-td sb-td--rank">${rank}</td>
      <td class="sb-td sb-td--user">${player.username}${isMe ? " <span style=\"color:var(--cyan);opacity:0.6;font-size:10px;\">[you]</span>" : ""}</td>
      <td class="sb-td sb-td--score">${fmt(player.score)}</td>
      <td class="sb-td sb-td--solves">${player.solves}</td>
      <td class="sb-td sb-td--bloods">${bloodsHtml}</td>
      <td class="sb-td sb-td--joined">${player.joined}</td>
    `;

    tr.addEventListener("click", function () {
      window.location.href = "/profile/" + player.username;
    });

    return tr;
  }

  /** Render all rows into tbody (no animation) */
  function renderRows() {
    applySortToData();
    tbody.innerHTML = "";

    tableData.forEach(function (player, idx) {
      const rank = idx + 1;
      const row  = buildRow(player, rank);

      // Apply search visibility
      if (searchQuery && !player.username.toLowerCase().includes(searchQuery)) {
        if (player.username !== CURRENT_USER) {
          row.style.display = "none";
        }
      }

      tbody.appendChild(row);
    });
  }

  /** Animated reorder: fade-out → rebuild → fade-in */
  function animatedReorder() {
    tbody.classList.add("sb-tbody-fading");
    tbody.classList.remove("sb-tbody-visible");

    setTimeout(function () {
      renderRows();
      tbody.classList.remove("sb-tbody-fading");
      tbody.classList.add("sb-tbody-visible");

      // Remove the transition class after it's done
      setTimeout(function () {
        tbody.classList.remove("sb-tbody-visible");
      }, 160);
    }, 150);
  }

  /** Update which sort pill is active */
  function updatePillActive(activeSortKey) {
    sortPills.forEach(function (pill) {
      const isActive = pill.dataset.sort === activeSortKey;
      pill.classList.toggle("sb-pill--active", isActive);
      pill.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  /** Update which column header is active + show arrow direction */
  function updateThActive(activeKey, dir) {
    colHeaders.forEach(function (th) {
      if (!th) return;
      const col = th.dataset.col;
      const isActive = col === activeKey;

      th.classList.toggle("is-sorted", isActive);
      th.setAttribute("aria-sort", isActive ? (dir === "desc" ? "descending" : "ascending") : "none");

      const arrow = th.querySelector(".sb-sort-arrow");
      if (arrow) {
        if (isActive) {
          arrow.textContent = dir === "desc" ? "▼" : "▲";
          arrow.style.opacity = "1";
        } else {
          arrow.textContent = "";
          arrow.style.opacity = "0";
        }
      }
    });
  }

  /* ─── Event: sort pills ─────────────────────────────────────────── */
  sortPills.forEach(function (pill) {
    pill.addEventListener("click", function () {
      const key = SORT_KEY_MAP[pill.dataset.sort] || "score";

      if (sortKey === key) {
        sortDir = sortDir === "desc" ? "asc" : "desc";
      } else {
        sortKey = key;
        sortDir = "desc";
      }

      updatePillActive(pill.dataset.sort);
      updateThActive(key, sortDir);
      animatedReorder();
    });
  });

  /* ─── Event: column header clicks ──────────────────────────────── */
  colHeaders.forEach(function (th) {
    if (!th) return;
    th.addEventListener("click", function () {
      const key = TH_KEY_MAP[th.dataset.col] || "score";

      if (sortKey === key) {
        sortDir = sortDir === "desc" ? "asc" : "desc";
      } else {
        sortKey = key;
        sortDir = "desc";
      }

      updatePillActive(key);
      updateThActive(key, sortDir);
      animatedReorder();
    });
  });

  /* ─── Event: search input ───────────────────────────────────────── */
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchQuery = searchInput.value.trim().toLowerCase();

      // Show / hide rows based on search — current user always visible
      const rows = tbody.querySelectorAll(".sb-tr");
      rows.forEach(function (row) {
        const username = (row.dataset.username || "").toLowerCase();
        const isMe     = username === CURRENT_USER.toLowerCase();
        const matches  = username.includes(searchQuery);

        row.style.display = (matches || isMe || !searchQuery) ? "" : "none";
      });
    });
  }

  /* ─── Initial render ────────────────────────────────────────────── */
  renderRows();

  // Set initial arrow state on Score column
  updateThActive("score", "desc");

}());
