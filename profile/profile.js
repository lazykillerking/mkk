(function () {
  // Profile page controller: boot animation, heatmap, parallax card, table tools, and copy flow.
  const body = document.body;
  const boot = document.getElementById("profile-boot");
  const bootLines = Array.from(document.querySelectorAll("[data-boot-line]"));
  const bootCursor = document.getElementById("boot-cursor");
  const hero = document.getElementById("profile-hero");
  const hackerCard = document.getElementById("hacker-card");
  const heatmapGrid = document.getElementById("heatmap-grid");
  const heatmapMonths = document.getElementById("heatmap-months");
  const tooltip = document.getElementById("heatmap-tooltip");
  const scrollBars = Array.from(document.querySelectorAll("[data-animate-on-scroll]"));
  const historySearch = document.getElementById("history-search");
  const historyBody = document.getElementById("history-table-body");
  const sortButtons = Array.from(document.querySelectorAll(".sort-button"));
  const copyButton = document.getElementById("copy-card-button");
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  const bootText = [
    // These strings are printed into the fake terminal overlay before the page reveals.
    "> initializing session...",
    "> fetching profile: lazykillerking",
    "> clearance level: player",
    "> identity confirmed. rendering..."
  ];
  const heatmapData = [
    // Each nested array is a week, and each value is the number of solves for a day.
    [0,0,0,1,0,0,0],[0,0,1,0,0,0,0],[0,0,0,0,1,0,0],[0,1,0,0,0,0,0],
    [0,0,0,0,1,0,0],[0,0,1,0,0,0,0],[0,0,0,0,1,0,0],[0,1,0,0,0,0,0],
    [0,0,0,1,1,0,0],[0,1,0,1,0,0,0],[0,0,1,1,0,0,0],[0,1,1,0,0,0,0],
    [0,1,0,0,1,0,0],[0,1,1,0,1,0,0],[0,0,1,1,0,1,0],[0,1,0,1,1,0,0],
    [1,0,1,0,1,0,0],[0,1,1,1,0,0,0],[1,0,1,1,0,1,0],[1,1,0,1,1,0,0],
    [1,1,1,0,0,1,0],[0,1,0,2,1,0,0],[1,0,2,1,0,1,0],[1,1,0,2,1,0,0],
    [0,2,1,1,0,1,0],[1,0,2,0,1,1,0],[1,2,0,1,2,0,0],[1,0,1,2,0,2,0],
    [2,1,2,0,1,0,1],[2,0,2,1,0,2,0],[1,2,0,1,2,1,0],[2,1,2,1,0,2,1],
    [2,1,0,2,1,2,0],[1,2,2,1,2,1,0],[2,0,2,1,2,0,1],[2,2,1,2,1,2,0],
    [1,2,1,2,2,1,0],[2,1,2,2,1,2,0],[2,2,2,1,2,1,1],[2,1,2,2,1,2,1],
    [2,2,1,2,3,2,1],[2,3,2,3,2,1,2],[1,2,3,2,3,2,1],[2,3,2,2,3,1,2],
    [3,2,1,3,2,3,2],[3,2,3,2,3,2,1],[2,3,2,3,3,2,2],[3,2,3,2,3,2,1],
    [3,3,2,3,2,3,2],[2,3,3,2,3,3,2],[3,2,3,3,2,3,2],[2,3,3,2,3,3,2]
  ];
  const startDate = new Date(Date.UTC(2026, 0, 1));
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  let frameId = null;
  let cardShiftX = 0;
  let cardShiftY = 0;
  let sortState = { key: "challenge", direction: "asc" };

  function getHeatmapDate(weekIndex, dayIndex) {
    // Heatmap labels and cells both use this helper so month headers stay aligned with the grid.
    const date = new Date(startDate.getTime());
    date.setUTCDate(startDate.getUTCDate() + (weekIndex * 7) + dayIndex);
    return date;
  }

  async function runBootSequence() {
    // Type lines in sequence, flash the cursor, then reveal the actual profile content.
    for (let index = 0; index < bootText.length; index += 1) {
      bootLines[index].textContent = bootText[index];
      await sleep(120);
    }
    bootCursor.classList.add("is-visible");
    await sleep(300);
    boot.classList.add("is-hidden");
    await sleep(300);
    body.classList.remove("profile-booting");
    body.classList.add("is-ready");
    reveals.forEach((node) => {
      node.classList.remove("reveal");
      void node.offsetWidth;
      node.classList.add("reveal");
    });
    boot.remove();
  }

  function buildHeatmap() {
    // Build the contribution-style heatmap entirely from the static heatmapData matrix.
    let previousMonth = null;

    heatmapData.forEach((week, weekIndex) => {
      const isCurrentWeek = weekIndex === heatmapData.length - 1;
      const wrapper = isCurrentWeek ? document.createElement("div") : heatmapGrid;
      const weekStartDate = getHeatmapDate(weekIndex, 0);
      const weekMonth = weekStartDate.getUTCMonth();

      if (isCurrentWeek) {
        wrapper.className = "heatmap-week-current";
        wrapper.style.gridColumn = String(weekIndex + 1);
      }

      if (heatmapMonths && weekMonth !== previousMonth) {
        // Month headers are anchored to the first week column where that month appears.
        const monthLabel = document.createElement("span");
        monthLabel.textContent = weekStartDate.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC"
        });
        monthLabel.style.gridColumn = String(weekIndex + 1);
        heatmapMonths.appendChild(monthLabel);
        previousMonth = weekMonth;
      }

      week.forEach((solves, dayIndex) => {
        const cell = document.createElement("div");
        const date = getHeatmapDate(weekIndex, dayIndex);
        cell.className = "heatmap-cell";
        cell.dataset.level = String(Math.min(solves, 3));
        cell.dataset.solves = String(solves);
        cell.dataset.date = date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

        if (!isCurrentWeek) {
          cell.style.gridColumn = String(weekIndex + 1);
          cell.style.gridRow = String(dayIndex + 1);
        } else {
          cell.style.gridRow = String(dayIndex + 1);
        }

        wrapper.appendChild(cell);
      });

      if (isCurrentWeek) {
        heatmapGrid.appendChild(wrapper);
      }
    });
  }

  function bindHeatmapTooltip() {
    // Tooltip follows the cursor so the grid can stay compact and label-free.
    function moveTooltip(event) {
      tooltip.style.left = event.clientX + "px";
      tooltip.style.top = event.clientY - 14 + "px";
    }

    Array.from(document.querySelectorAll(".heatmap-cell")).forEach((cell) => {
      cell.addEventListener("mouseenter", (event) => {
        const solves = Number(cell.dataset.solves);
        tooltip.textContent = cell.dataset.date + " · " + solves + (solves === 1 ? " solve" : " solves");
        tooltip.classList.add("is-visible");
        moveTooltip(event);
      });
      cell.addEventListener("mousemove", moveTooltip);
      cell.addEventListener("mouseleave", () => tooltip.classList.remove("is-visible"));
    });
  }

  function applyParallax() {
    // CSS variables drive the hacker-card transform so layout stays in CSS.
    hackerCard.style.setProperty("--card-shift-x", cardShiftX.toFixed(2) + "px");
    hackerCard.style.setProperty("--card-shift-y", cardShiftY.toFixed(2) + "px");
    frameId = null;
  }

  function bindParallax() {
    // Mouse position over the hero section tilts the hacker card slightly.
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
    // Profile page bars animate only when they enter the viewport.
    scrollBars.forEach((bar) => {
      bar.classList.remove("is-animating");
      bar.classList.remove("is-scroll-active");
      bar.style.width = "0";
    });

    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
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
    // Table sorting reads from data-* attributes instead of parsing visible cell text.
    if (key === "points" || key === "position") {
      return Number(row.dataset[key]);
    }
    if (key === "solvedAt") {
      return new Date(row.dataset.solvedAt).getTime();
    }
    return row.dataset[key].toLowerCase();
  }

  function sortRows() {
    const rows = Array.from(historyBody.querySelectorAll("tr"));
    rows.sort((a, b) => {
      const aValue = getSortableValue(a, sortState.key);
      const bValue = getSortableValue(b, sortState.key);
      if (aValue < bValue) {
        return sortState.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortState.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    rows.forEach((row) => historyBody.appendChild(row));
  }

  function updateSortButtons() {
    sortButtons.forEach((button) => {
      const isActive = button.dataset.sortKey === sortState.key;
      button.classList.toggle("is-active", isActive);
      button.querySelector(".sort-button__arrow").textContent = isActive ? (sortState.direction === "asc" ? "▲" : "▼") : "";
    });
  }

  function bindHistoryTable() {
    // Search hides rows client-side; sorting simply reorders the existing DOM rows.
    sortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sortKey;
        if (sortState.key === key) {
          sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
        } else {
          sortState = { key: key, direction: "asc" };
        }
        updateSortButtons();
        sortRows();
      });
    });

    historySearch.addEventListener("input", () => {
      const query = historySearch.value.trim().toLowerCase();
      Array.from(historyBody.querySelectorAll("tr")).forEach((row) => {
        row.classList.toggle("is-hidden", Boolean(query) && !row.textContent.toLowerCase().includes(query));
      });
    });

    updateSortButtons();
    sortRows();
  }

  function bindCopyCard() {
    // html2canvas snapshots the hacker card and writes the PNG directly to the clipboard.
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

  // Initialize all interactive profile behaviors once the script loads.
  buildHeatmap();
  bindHeatmapTooltip();
  bindParallax();
  bindScrollBars();
  bindHistoryTable();
  bindCopyCard();
  runBootSequence();
}());
