(function () {
  const body = document.body;
  const boot = document.getElementById("profile-boot");
  const bootLines = Array.from(document.querySelectorAll("[data-boot-line]"));
  const bootCursor = document.getElementById("boot-cursor");
  const hero = document.getElementById("profile-hero");
  const hackerCard = document.getElementById("hacker-card");
  const heatmapGrid = document.getElementById("heatmap-grid");
  const heatmapMonths = document.getElementById("heatmap-months");
  const tooltip = document.getElementById("heatmap-tooltip");
  const historySearch = document.getElementById("history-search");
  const historyBody = document.getElementById("history-table-body");
  const sortButtons = Array.from(document.querySelectorAll(".sort-button"));
  const copyButton = document.getElementById("copy-card-button");
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  
  let frameId = null;
  let cardShiftX = 0;
  let cardShiftY = 0;
  let sortState = { key: "solvedAt", direction: "desc" };

  const bootText = [
    "> initializing session...",
    "> fetching authenticated profile...",
    "> clearance level: player",
    "> identity confirmed. rendering..."
  ];
  
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function runBootSequence() {
    // Replaced large artificial delays with fast non-blocking transitions to keep visual flair
    // without the unbearable load time lag
    for (let index = 0; index < bootText.length; index += 1) {
      if(bootLines[index]) bootLines[index].textContent = bootText[index];
      await sleep(20);
    }
    if(bootCursor) bootCursor.classList.add("is-visible");
    await sleep(50);
    if(boot) boot.classList.add("is-hidden");
    await sleep(50);
    body.classList.remove("profile-booting");
    body.classList.add("is-ready");
    reveals.forEach((node) => {
      node.classList.remove("reveal");
      void node.offsetWidth;
      node.classList.add("reveal");
    });
    if(boot) boot.remove();
  }

  function applyParallax() {
    if(!hackerCard) return;
    hackerCard.style.setProperty("--card-shift-x", cardShiftX.toFixed(2) + "px");
    hackerCard.style.setProperty("--card-shift-y", cardShiftY.toFixed(2) + "px");
    frameId = null;
  }

  function bindParallax() {
    if(!hero) return;
    hero.addEventListener("mousemove", (event) => {
      const rect = hero.getBoundingClientRect();
      cardShiftX = (((event.clientX - rect.left) / rect.width) - 0.5) * -12;
      cardShiftY = (((event.clientY - rect.top) / rect.height) - 0.5) * -12;
      if (!frameId) {
        frameId = window.requestAnimationFrame(applyParallax);
      }
    });

    hero.addEventListener("mouseleave", () => {
      cardShiftX = 0;
      cardShiftY = 0;
      if (!frameId) {
        frameId = window.requestAnimationFrame(applyParallax);
      }
    });
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

  function getSortableValue(row, key) {
    if (key === "points" || key === "position") {
      return Number(row.dataset[key] || 0);
    }
    if (key === "solvedAt") {
      return new Date(row.dataset.solvedAt || "1970-01-01").getTime();
    }
    return (row.dataset[key] || "").toLowerCase();
  }

  function sortRows() {
    if(!historyBody) return;
    const rows = Array.from(historyBody.querySelectorAll("tr"));
    rows.sort((a, b) => {
      const aValue = getSortableValue(a, sortState.key);
      const bValue = getSortableValue(b, sortState.key);
      if (aValue < bValue) return sortState.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortState.direction === "asc" ? 1 : -1;
      return 0;
    });
    rows.forEach((row) => historyBody.appendChild(row));
  }

  function updateSortButtons() {
    sortButtons.forEach((button) => {
      const isActive = button.dataset.sortKey === sortState.key;
      button.classList.toggle("is-active", isActive);
      const arrow = button.querySelector(".sort-button__arrow");
      if(arrow) arrow.textContent = isActive ? (sortState.direction === "asc" ? "▲" : "▼") : "";
    });
  }

  function bindHistoryTable() {
    sortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sortKey;
        if (sortState.key === key) {
          sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
        } else {
          sortState = { key: key, direction: "desc" };
        }
        updateSortButtons();
        sortRows();
      });
    });

    if(historySearch) {
      historySearch.addEventListener("input", () => {
        const query = historySearch.value.trim().toLowerCase();
        Array.from(historyBody.querySelectorAll("tr")).forEach((row) => {
          row.classList.toggle("is-hidden", Boolean(query) && !row.textContent.toLowerCase().includes(query));
        });
      });
    }

    updateSortButtons();
    sortRows();
  }

  function bindCopyCard() {
    if(!copyButton) return;
    copyButton.addEventListener("click", async () => {
      if (typeof window.html2canvas !== "function") return;

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
        if (!blob) throw new Error("PNG export failed");
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

  // --- Dynamic Hydration Logic ---



  function renderHeatmap(solves) {
    if(!heatmapGrid) return;
    heatmapGrid.innerHTML = "";
    if(heatmapMonths) heatmapMonths.innerHTML = "";

    // Build past 52 weeks matrix
    const numWeeks = 52;
    const now = new Date();
    // Start grid perfectly aligned to Monday or Sunday if needed, here we just go back 364 days so it's 52 * 7
    let gridStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (numWeeks * 7));
    
    // Map dates to solve counts
    const dateCounts = {};
    solves.forEach(s => {
      const dt = s.timestamp.split("T")[0];
      dateCounts[dt] = (dateCounts[dt] || 0) + 1;
    });

    function getHeatmapDate(weekIndex, dayIndex) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + (weekIndex * 7) + dayIndex);
      return d;
    }

    let previousMonth = null;
    for(let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
      const isCurrentWeek = weekIndex === numWeeks - 1;
      const wrapper = isCurrentWeek ? document.createElement("div") : heatmapGrid;
      
      const weekStartDate = getHeatmapDate(weekIndex, 0);
      const weekMonth = weekStartDate.getMonth();

      if (isCurrentWeek) {
        wrapper.className = "heatmap-week-current";
        wrapper.style.gridColumn = String(weekIndex + 1);
      }

      if (heatmapMonths && weekMonth !== previousMonth) {
        const monthLabel = document.createElement("span");
        monthLabel.textContent = weekStartDate.toLocaleDateString("en-US", { month: "short" });
        monthLabel.style.gridColumn = String(weekIndex + 1);
        heatmapMonths.appendChild(monthLabel);
        previousMonth = weekMonth;
      }

      for(let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const cell = document.createElement("div");
        const dateObj = getHeatmapDate(weekIndex, dayIndex);
        const dateStr = dateObj.toISOString().split("T")[0];
        const solvesCount = dateCounts[dateStr] || 0;

        cell.className = "heatmap-cell";
        cell.dataset.level = String(Math.min(solvesCount, 3));
        cell.dataset.solves = String(solvesCount);
        cell.dataset.date = dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" });

        if (!isCurrentWeek) {
          cell.style.gridColumn = String(weekIndex + 1);
          cell.style.gridRow = String(dayIndex + 1);
        } else {
          cell.style.gridRow = String(dayIndex + 1);
        }
        wrapper.appendChild(cell);
      }

      if (isCurrentWeek) heatmapGrid.appendChild(wrapper);
    }

    // Tooltip logic
    if(!tooltip) return;
    function moveTooltip(event) {
      tooltip.style.left = event.clientX + "px";
      tooltip.style.top = (event.clientY - 14) + "px";
    }
    Array.from(document.querySelectorAll(".heatmap-cell")).forEach((cell) => {
      cell.addEventListener("mouseenter", (evt) => {
        const solves = Number(cell.dataset.solves);
        tooltip.textContent = cell.dataset.date + " · " + solves + (solves === 1 ? " solve" : " solves");
        tooltip.classList.add("is-visible");
        moveTooltip(evt);
      });
      cell.addEventListener("mousemove", moveTooltip);
      cell.addEventListener("mouseleave", () => tooltip.classList.remove("is-visible"));
    });
  }

  function renderCategoryCard(stats) {
    const barsContainer = document.getElementById("category-bars");
    const radarContainer = document.getElementById("radar-pane");
    if(!barsContainer || !radarContainer) return;

    // Build bars
    let barsHtml = "";
    const topCats = stats.categoryStats.slice(0, 5);
    topCats.forEach(cat => {
      const cls = cat.percent > 70 ? " bar-fill--strong" : "";
      barsHtml += `
        <div class="performance-row">
          <div class="performance-labels"><span>${cat.label}</span><span>${cat.percent}% <span class="performance-note">(${cat.count} solve${cat.count===1?'':'s'})</span></span></div>
          <div class="bar-track"><span class="bar-fill${cls}" data-bar-width="${cat.percent}" data-animate-on-scroll></span></div>
        </div>`;
    });
    barsContainer.innerHTML = barsHtml;

    // Mini card bars in hero
    const mini = document.getElementById("hacker-card-mini");
    if(mini && topCats.length > 0) {
      mini.innerHTML = `
        <div class="hacker-card__mini-label">${topCats[0].label} Main</div>
        <div class="bar-track"><span class="bar-fill bar-fill--cyan" style="width: ${topCats[0].percent}%"></span></div>
      `;
    }

    // Build SVG Radar
    const N = topCats.length > 2 ? topCats.length : 5; 
    // Fallback to 5 edges if not enough varied categories exist yet
    const renderCats = topCats.length === N ? topCats : [
      {label: "WEB", percent: 0}, {label: "FORENSICS", percent: 0}, {label: "CRYPTO", percent: 0}, {label: "REVERSE", percent: 0}, {label: "OSINT", percent: 0}
    ];

    let svg = '<svg class="radar-chart" viewBox="0 0 220 220" role="img" aria-label="Category radar chart">';
    svg += '<g transform="translate(110 110)">';
    const getPoints = (scale) => {
      let pts = [];
      const r = 80 * scale;
      for (let i=0; i<N; i++) {
        const angle = (i * 2 * Math.PI / N) - Math.PI / 2;
        pts.push(`${(Math.cos(angle)*r).toFixed(2)},${(Math.sin(angle)*r).toFixed(2)}`);
      }
      return pts.join(" ");
    };
    svg += `<polygon points="${getPoints(1)}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"></polygon>`;
    svg += `<polygon points="${getPoints(0.6)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"></polygon>`;
    
    let dataPtsArray = [];
    let dots = "";
    for (let i=0; i<N; i++) {
       const angle = (i * 2 * Math.PI / N) - Math.PI / 2;
       // Axes
       const ax = (Math.cos(angle)*80).toFixed(2);
       const ay = (Math.sin(angle)*80).toFixed(2);
       svg += `<line x1="0" y1="0" x2="${ax}" y2="${ay}" stroke="rgba(255,255,255,0.12)" stroke-width="1"></line>`;
       // Labels
       const tx = (Math.cos(angle)*92).toFixed(2);
       const ty = (Math.sin(angle)*92 + 4).toFixed(2);
       let anchor = "middle";
       if (tx > 15) anchor = "start";
       else if (tx <-15) anchor = "end";
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

  function renderHistoryTable(solves, staticChallenges) {
    if(!historyBody) return;
    
    const sortedSolves = [...solves].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    let rowsHtml = "";

    sortedSolves.forEach((s, idx) => {
      const challenge = staticChallenges.find(c => c.id === s.id);
      if(!challenge) return;
      const t = new Date(s.timestamp);
      const timeStr = t.toISOString().split('T')[0] + " " + t.toISOString().split('T')[1].substring(0,5) + " UTC";
      const pos = idx + 1;
      const posClass = pos === 1 ? ' class="history-position--first"' : '';
      const posLabel = pos === 1 ? '⚡ First' : (pos + (['st','nd','rd'][((pos+90)%100-10)%10-1]||'th'));

      rowsHtml += `
        <tr data-challenge="${challenge.name}" data-category="${challenge.category}" data-points="${challenge.points}" data-solved-at="${s.timestamp}" data-position="${pos}">
          <td>${challenge.name}</td>
          <td>${challenge.category}</td>
          <td class="history-points">${challenge.points}</td>
          <td class="history-time">${timeStr}</td>
          <td${posClass}>${posLabel}</td>
        </tr>
      `;
    });

    historyBody.innerHTML = rowsHtml || `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No challenges solved yet.</td></tr>`;
    bindHistoryTable(); // Rebind sorting logic after injecting
  }

  function renderBadges(stats, totalScore) {
    const strip = document.getElementById("badges-strip");
    if(!strip) return;

    let badges = [];
    if(stats.totalSolves > 0) {
      badges.push('<span class="badge-pill badge-pill--amber" title="Earned for first local solve">⚡ First Blood</span>');
    }
    if(stats.bestStreak >= 4) {
      badges.push(`<span class="badge-pill badge-pill--fire" title="${stats.bestStreak}-day active solve streak">🔥 ${stats.bestStreak}-day Streak</span>`);
    }
    if(stats.categoryStats.length > 0 && stats.categoryStats[0].percent >= 50) {
      badges.push(`<span class="badge-pill badge-pill--cyan" title="Dominant category">🧠 ${stats.categoryStats[0].label} Main</span>`);
    }
    
    strip.innerHTML = badges.join("");
  }

  function hydrateStats(profile, stats) {
    // Top hero stats
    document.getElementById("hero-pts").dataset.target = profile.score || 0;
    document.getElementById("hero-rank").dataset.target = profile.rank || "--"; // Assuming rank isn't strictly computed
    document.getElementById("hero-solves").dataset.target = stats.totalSolves;

    // Hacker card inner
    const cardStats = document.getElementById("hacker-card-stats");
    if(cardStats) {
      cardStats.innerHTML = `
        <span>#${profile.rank || '--'}</span>
        <span>·</span>
        <span>${(profile.score || 0).toLocaleString()} pts</span>
        <span>·</span>
        <span>${stats.totalSolves} <span class="accent">✓</span></span>
      `;
    }

    // Tiles
    document.getElementById("tile-score").dataset.target = profile.score || 0;
    document.getElementById("tile-rank").dataset.target = profile.rank || "--";
    document.getElementById("tile-rate").textContent = stats.solveRate + "%";
    document.getElementById("tile-streak").textContent = stats.bestStreak;
    
    // Dispatch countup trigger if script handles dynamic targets, but since countup relies on generic DOM iteration on load, 
    // we manually recreate the numbers. If countup.js relies on initial load, we might just set text directly here to be safe:
    document.getElementById("hero-pts").textContent = (profile.score || 0).toLocaleString();
    document.getElementById("hero-rank").textContent = profile.rank || "--";
    document.getElementById("hero-solves").textContent = stats.totalSolves;
    document.getElementById("tile-score").textContent = (profile.score || 0).toLocaleString();
    document.getElementById("tile-rank").textContent = profile.rank || "--";
  }

  // --- Exposed Global Init ---
  window.initProfileData = function(user, profile, localSolves, allChallenges, stats) {
    // 2. Hydrate flat numbers
    hydrateStats(profile, stats);
    
    // 3. Render Complex Components
    renderHeatmap(localSolves);
    renderCategoryCard(stats);
    renderHistoryTable(localSolves, allChallenges);
    renderBadges(stats);
    
    // 4. Bind interactive elements
    bindScrollBars();
    
    // Let the boot sequence run and clear loading state
    runBootSequence();
  };

  // Bind statics
  bindParallax();
  bindCopyCard();

  // Note: we don't call runBootSequence here automatically anymore, to wait for data.
}());
