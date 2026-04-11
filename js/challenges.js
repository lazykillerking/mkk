(function () {
  // Client-side challenge board with localStorage-backed persistence.
  // Everything on the page is derived from this in-memory state object.
  var STORAGE_KEY = "mkk_ctf_challenges_static";
  var SOLVED_KEY = "mkk_ctf_challenges_solved";
  var CATEGORIES = ["WEB", "CRYPTO", "FORENSICS", "PWN", "REVERSE", "MISC", "OSINT", "WELCOME"];
  var DEFAULT_CHALLENGES = [];

  var state = {
    // App state tracks challenge data, filters, current selection, and admin UI state.
    challenges: [], // Initially empty, populated by async loadChallenges()
    solvedIds: loadSolvedIds(),
    category: "ALL",
    search: "",
    selectedId: null,
    adminOpen: false
  };

  var nodes = {
    // Centralized DOM lookup keeps the render/bind functions simple and predictable.
    filters: document.getElementById("challenge-filters"),
    grid: document.getElementById("challenge-grid"),
    empty: document.getElementById("challenge-empty"),
    search: document.getElementById("challenge-search"),
    totalCount: document.getElementById("challenge-total-count"),
    visibleCount: document.getElementById("challenge-visible-count"),
    topCategory: document.getElementById("challenge-top-category"),
    adminToggle: document.querySelector("[data-admin-toggle]"),
    adminPanel: document.querySelector("[data-admin-panel]"),
    adminForm: document.getElementById("challenge-admin-form"),
    adminList: document.getElementById("challenge-admin-list"),
    adminCategory: document.getElementById("challenge-admin-category"),
    modal: document.getElementById("challenge-modal"),
    modalTitle: document.getElementById("challenge-modal-title"),
    modalCategory: document.getElementById("challenge-modal-category"),
    modalPoints: document.getElementById("challenge-modal-points"),
    modalDescription: document.getElementById("challenge-modal-description"),
    modalAuthor: document.getElementById("challenge-modal-author"),
    modalDownload: document.getElementById("challenge-modal-download"),
    modalFile: document.getElementById("challenge-modal-file"),
    modalHints: document.getElementById("challenge-modal-hints"),
    modalFeedback: document.getElementById("challenge-modal-feedback"),
    modalFlagForm: document.querySelector(".challenge-modal__flag"),
    modalFlagInput: document.querySelector(".challenge-modal__flag input")
  };

  if (!nodes.grid || !nodes.filters || !nodes.modal) {
    return;
  }

  window.initAdminMode = function (isAdmin) {
    if (nodes.adminToggle) {
      nodes.adminToggle.hidden = !isAdmin;
    }
    if (!isAdmin) {
      state.adminOpen = false;
      renderAdminVisibility();
    }
  };

  populateAdminCategories();
  bindEvents();
  render();
  loadChallenges();

  async function loadChallenges() {
    try {
      const { supabase } = await import('./supabase.js');
      const { data, error } = await supabase.from("challenges").select("*");
      
      if (error) throw error;
      
      // Map Supabase DB schema back to the JS properties your UI expects
      state.challenges = (data || []).map(function(row) {
        return {
          id: String(row.id),
          name: row.title,       // Maps DB 'title' to UI 'name'
          description: row.description,
          category: row.category,
          author: row.author || "admin",
          points: row.points,
          difficulty: row.difficulty || "Easy",
          hints: row.hints || [],
          solves: row.solves || 0,
          fileName: row.file_name || "",
          flag: row.flag
        };
      });

      render(); // Update UI logic now that challenges are loaded
    } catch (error) {
      console.error("Error fetching challenges from Supabase:", error);
    }
  }

  function saveChallenges() {
    // No-op: Supabase is now the source of truth for challenges.
    // Retained to prevent ReferenceError when other parts of the UI call it.
  }

  // Solved challenge ids are stored separately so we can preserve solve state
  // without mutating the original challenge definitions too aggressively.
  // Now tracks objects with { id, timestamp } rather than raw strings.
  function loadSolvedIds() {
    try {
      var stored = window.localStorage.getItem(SOLVED_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        return normalizeSolvedData(parsed);
      }
    } catch (error) {
      console.warn("Unable to access solved challenge state.", error);
    }

    return [];
  }

  function normalizeSolvedData(data) {
    if (!Array.isArray(data)) return [];
    
    var normalized = [];
    var seenIds = {};
    var now = Date.now();
    
    data.forEach(function (item, index) {
      var id, timestamp;
      if (typeof item === "string" || typeof item === "number") {
        id = String(item);
        // Spread legacy solves into the past randomly (1 to 14 days ago)
        timestamp = new Date(now - (Math.floor(Math.random() * 14) + 1) * 86400000).toISOString();
      } else if (item && typeof item === "object") {
        id = String(item.id);
        timestamp = item.timestamp || new Date().toISOString();
      }
      
      if (id && !seenIds[id]) {
        seenIds[id] = true;
        normalized.push({ id: id, timestamp: timestamp });
      }
    });

    // Write back immediately once, so strings become objects everywhere next load
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify(normalized));
    
    return normalized;
  }

  // Write the current solved-ids array back to localStorage.
  function saveSolvedIds() {
    try {
      window.localStorage.setItem(SOLVED_KEY, JSON.stringify(state.solvedIds));
    } catch (error) {
      console.warn("Unable to persist solved challenge state.", error);
    }
  }

  function bindEvents() {
    // Bind once up front; subsequent updates happen through render() only.
    if (nodes.search) {
      nodes.search.addEventListener("input", function (event) {
        state.search = String(event.target.value || "").trim().toLowerCase();
        render();
      });
    }

    if (nodes.adminToggle) {
      nodes.adminToggle.addEventListener("click", function () {
        state.adminOpen = !state.adminOpen;
        renderAdminVisibility();
      });
    }

    if (nodes.adminForm) {
      nodes.adminForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        try {
          const { supabase } = await import('./supabase.js');
          // 1. Supabase Admin Check
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError || !user) {
            alert("Authentication error: Please log in.");
            return;
          }

          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("is_admin")
            .eq("id", user.id)
            .single();

          if (userError || userData.is_admin !== true) {
            alert("Access Denied: Only administrators can create challenges.");
            return;
          }

          // 2. Build insertion - only columns that exist in the challenges table
          var formData = new FormData(nodes.adminForm);
          var newChallengeData = {
            title: String(formData.get("name") || "").trim(),       // UI 'name' -> DB 'title'
            description: String(formData.get("description") || "").trim(),
            category: String(formData.get("category") || "WEB").trim(),
            points: parseInt(formData.get("points") || "0", 10),
            flag: String(formData.get("flag") || "").trim()
          };

          // 3. Supabase DB Insert
          const { error: insertError } = await supabase
            .from("challenges")
            .insert([newChallengeData]);

          if (insertError) throw insertError;

          // 4. Success triggers UI reset and refresh from DB
          nodes.adminForm.reset();
          if (nodes.adminCategory) {
            nodes.adminCategory.value = "WEB";
          }
          await loadChallenges(); // Re-fetches the list from DB and automatically triggers render()

        } catch (error) {
          console.error("Unexpected error creating challenge:", error);
          alert("An unexpected error occurred while creating the challenge. " + (error.message || ""));
        }
      });
    }

    nodes.grid.addEventListener("click", function (event) {
      // Cards are rendered dynamically, so the grid uses event delegation.
      var card = event.target.closest("[data-challenge-id]");

      if (!card) {
        return;
      }

      openModal(card.getAttribute("data-challenge-id"));
    });

    // Allow keyboard users to open a challenge card with Enter or Space.
    nodes.grid.addEventListener("keydown", function (event) {
      var card = event.target.closest("[data-challenge-id]");

      if (!card) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(card.getAttribute("data-challenge-id"));
      }
    });

    if (nodes.adminList) {
      // Admin delete buttons are also handled through delegation.
      nodes.adminList.addEventListener("click", function (event) {
        var button = event.target.closest("[data-remove-id]");

        if (!button) {
          return;
        }

        var id = button.getAttribute("data-remove-id");
        state.challenges = state.challenges.filter(function (challenge) {
          return challenge.id !== id;
        });
        state.solvedIds = state.solvedIds.filter(function (solved) {
          return solved.id !== id;
        });

        if (state.selectedId === id) {
          closeModal();
        }

        saveChallenges();
        saveSolvedIds();
        render();
      });
    }

    // Close the detail modal when the backdrop or × button is clicked.
    nodes.modal.addEventListener("click", function (event) {
      if (event.target.hasAttribute("data-modal-close")) {
        closeModal();
      }
    });

    // Toggle individual hint visibility inside the modal via event delegation.
    // Flips aria-expanded and the sibling content's hidden attribute.
    nodes.modal.addEventListener("click", function (event) {
      var toggle = event.target.closest("[data-hint-toggle]");

      if (!toggle) {
        return;
      }

      var content = toggle.parentElement.querySelector(".challenge-hint__content");
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      if (content) {
        content.hidden = expanded;
      }
    });

    if (nodes.modalFlagForm) {
      nodes.modalFlagForm.addEventListener("submit", function (event) {
        event.preventDefault();
        handleFlagSubmit();
      });
    }

    // Global Escape key handler dismisses whichever modal is currently open.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  // Fill the admin form's category <select> with <option> elements from CATEGORIES.
  // Called once at startup so the dropdown is ready before any admin interaction.
  function populateAdminCategories() {
    if (!nodes.adminCategory) {
      return;
    }

    nodes.adminCategory.innerHTML = CATEGORIES.map(function (category) {
      return '<option value="' + category + '">' + category + "</option>";
    }).join("");
  }

  function render() {
    // One render pass redraws all derived UI from the current state snapshot.
    renderFilters();
    renderGrid();
    renderStats();
    renderAdminList();
    renderAdminVisibility();
    renderModal();
  }

  function getFilteredChallenges() {
    // Search currently matches challenge names only, after category filtering.
    return state.challenges.filter(function (challenge) {
      var categoryMatch = state.category === "ALL" || challenge.category === state.category;
      var query = state.search;

      if (!query) {
        return categoryMatch;
      }

      return categoryMatch && challenge.name.toLowerCase().indexOf(query) !== -1;
    });
  }

  function renderFilters() {
    var counts = getCategoryCounts();
    var filters = [{ label: "ALL", count: state.challenges.length }].concat(CATEGORIES.map(function (category) {
      return { label: category, count: counts[category] || 0 };
    }));

    nodes.filters.innerHTML = filters.map(function (filter) {
      var isActive = filter.label === state.category;
      return (
        '<button class="challenge-filter' + (isActive ? " is-active" : "") + '" type="button" data-filter="' + filter.label + '">' +
          filter.label + " (" + filter.count + ")" +
        "</button>"
      );
    }).join("");

    nodes.filters.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.category = button.getAttribute("data-filter");
        render();
      });
    });
  }

  // The list view shows a richer card summary while keeping the modal as the
  // place for full description, hints, download, and flag submission.
  function renderGrid() {
    // Cards stay intentionally minimal; full details live in the modal.
    var filtered = getFilteredChallenges();
    nodes.grid.innerHTML = filtered.map(function (challenge) {
      var solvedClass = isSolved(challenge.id) ? " challenge-card--solved" : "";
      var tagLabel = challenge.tagLabel || "No Tags";
      var visibility = challenge.visibility || (challenge.points >= 200 ? "private" : "public");
      var solvedMarkup = isSolved(challenge.id)
        ? '<span class="challenge-card__status challenge-card__status--solved"><span class="challenge-card__status-icon">&#10003;</span>SOLVED</span>'
        : '<span class="challenge-card__status challenge-card__status--unsolved">UNSOLVED</span>';

      return (
        '<article class="glass-card challenge-card' + solvedClass + '" tabindex="0" role="button" aria-label="Open ' + escapeHtml(challenge.name) + ' details" data-challenge-id="' + challenge.id + '">' +
          '<div class="challenge-card__top">' +
            '<div class="challenge-card__iconbox" aria-hidden="true"><span>CTF</span></div>' +
            '<div class="challenge-card__header">' +
              "<h3>" + escapeHtml(challenge.name) + "</h3>" +
              '<p class="challenge-card__line">Author: ' + escapeHtml(challenge.author) + "</p>" +
              '<p class="challenge-card__line">Category: ' + escapeHtml(formatCategory(challenge.category)) + "</p>" +
            "</div>" +
          "</div>" +
          '<div class="challenge-card__info-row">' +
            '<span class="challenge-card__info-pill">' + formatNumber(challenge.points) + " pts</span>" +
            '<span class="challenge-card__info-pill">' + formatNumber(challenge.solves) + " solves</span>" +
          "</div>" +
          '<div class="challenge-card__meta-row">' +
            '<span class="challenge-card__meta-item"><span class="challenge-card__meta-icon">&#9718;</span>' + escapeHtml(challenge.difficulty) + "</span>" +
            '<span class="challenge-card__meta-item"><span class="challenge-card__meta-icon">&#9873;</span>' + escapeHtml(tagLabel) + "</span>" +
            '<span class="challenge-card__meta-item"><span class="challenge-card__meta-icon">&#9678;</span>' + escapeHtml(visibility) + "</span>" +
          "</div>" +
          '<div class="challenge-card__actions">' +
            solvedMarkup +
            '<button class="challenge-card__button" type="button">View More <span aria-hidden="true">&#8594;</span></button>' +
          "</div>" +
        "</article>"
      );
    }).join("");

    nodes.empty.hidden = filtered.length !== 0;
  }

  // Update the three hero stat cards with current totals.
  // Top category is computed by iterating all categories and finding the max count.
  function renderStats() {
    var filtered = getFilteredChallenges();
    var counts = getCategoryCounts();
    var topCategory = "ALL";
    var topCount = 0;

    CATEGORIES.forEach(function (category) {
      if ((counts[category] || 0) > topCount) {
        topCategory = category;
        topCount = counts[category];
      }
    });

    if (nodes.totalCount) {
      nodes.totalCount.textContent = formatNumber(state.challenges.length);
    }
    if (nodes.visibleCount) {
      nodes.visibleCount.textContent = formatNumber(filtered.length);
    }
    if (nodes.topCategory) {
      nodes.topCategory.textContent = topCategory;
    }
  }

  // Rebuild the admin sidebar list of deletable challenges.
  // Each item has a [data-remove-id] button handled by delegation in bindEvents().
  function renderAdminList() {
    if (!nodes.adminList) {
      return;
    }

    nodes.adminList.innerHTML = '<div class="challenge-admin-list__items">' + state.challenges.map(function (challenge) {
      return (
        '<div class="challenge-admin-list__item">' +
          "<div>" +
            "<strong>" + escapeHtml(challenge.name) + "</strong>" +
            '<p>' + escapeHtml(challenge.category) + " | " + formatNumber(challenge.points) + " pts</p>" +
          "</div>" +
          '<button class="challenge-admin-remove" type="button" aria-label="Remove challenge" data-remove-id="' + challenge.id + '">&times;</button>' +
        "</div>"
      );
    }).join("") + "</div>";
  }

  // Show or hide the admin panel and update the toggle button label/aria state.
  function renderAdminVisibility() {
    if (!nodes.adminPanel || !nodes.adminToggle) {
      return;
    }

    nodes.adminPanel.hidden = !state.adminOpen;
    nodes.adminToggle.setAttribute("aria-pressed", state.adminOpen ? "true" : "false");
    nodes.adminToggle.textContent = state.adminOpen ? "Admin unlocked" : "Admin mode";
  }

  // Open the detail modal for the challenge matching the given id.
  // Adds .challenge-modal-open on <body> to prevent background scrolling.
  function openModal(id) {
    state.selectedId = id;
    renderModal();
    nodes.modal.hidden = false;
    document.body.classList.add("challenge-modal-open");
  }

  // Close the detail modal, clear any feedback text, and reset the flag input.
  function closeModal() {
    state.selectedId = null;
    nodes.modal.hidden = true;
    resetFeedback(nodes.modalFeedback);
    if (nodes.modalFlagInput) {
      nodes.modalFlagInput.value = "";
    }
    document.body.classList.remove("challenge-modal-open");
  }

  function renderModal() {
    // The modal is a projection of the currently selected challenge object.
    var challenge = getSelectedChallenge();

    if (!challenge) {
      nodes.modal.hidden = true;
      return;
    }

    nodes.modalTitle.textContent = challenge.name;
    nodes.modalCategory.className = "challenge-badge " + categoryClass(challenge.category);
    nodes.modalCategory.textContent = challenge.category;
    nodes.modalPoints.textContent = formatNumber(challenge.points) + " pts";
    nodes.modalDescription.textContent = challenge.description;
    nodes.modalAuthor.textContent = "by " + challenge.author + " | " + formatNumber(challenge.solves) + " solves | " + challenge.difficulty;

    if (challenge.fileName) {
      nodes.modalDownload.hidden = false;
      nodes.modalFile.textContent = challenge.fileName;
    } else {
      nodes.modalDownload.hidden = true;
      nodes.modalFile.textContent = "";
    }

    nodes.modalHints.innerHTML = challenge.hints.length ? challenge.hints.map(function (hint, index) {
      return (
        '<div class="challenge-hint">' +
          '<button class="challenge-hint__toggle" type="button" data-hint-toggle aria-expanded="false">' +
            "<span>Hint " + (index + 1) + "</span>" +
            "<span>+</span>" +
          "</button>" +
          '<div class="challenge-hint__content" hidden>' + escapeHtml(hint) + "</div>" +
        "</div>"
      );
    }).join("") : '<p class="challenge-hint__content">No hints available for this challenge.</p>';

    if (isSolved(challenge.id)) {
      setFeedback(nodes.modalFeedback, "Flag already solved on this browser.", "success");
    } else {
      resetFeedback(nodes.modalFeedback);
    }
  }

  // Flag submission runs entirely client-side for this static prototype.
  function handleFlagSubmit() {
    // Solves are tracked per-browser, not per real authenticated user.
    var challenge = getSelectedChallenge();
    var submittedFlag = nodes.modalFlagInput ? String(nodes.modalFlagInput.value || "").trim() : "";

    if (!challenge) {
      return;
    }

    if (!submittedFlag) {
      setFeedback(nodes.modalFeedback, "Enter a flag before submitting.", "error");
      return;
    }

    if (submittedFlag !== challenge.flag) {
      setFeedback(nodes.modalFeedback, "Incorrect flag. Try again.", "error");
      return;
    }

    if (isSolved(challenge.id)) {
      setFeedback(nodes.modalFeedback, "This challenge is already solved on this browser.", "success");
      return;
    }

    state.solvedIds.push({
      id: challenge.id,
      timestamp: new Date().toISOString()
    });
    challenge.solves += 1;
    saveSolvedIds();
    saveChallenges();
    render();
    if (nodes.modalFlagInput) {
      nodes.modalFlagInput.value = "";
    }
    setFeedback(nodes.modalFeedback, "Flag accepted. Challenge solved.", "success");
  }

  // Look up the full challenge object for the currently open modal.
  function getSelectedChallenge() {
    return state.challenges.find(function (entry) {
      return entry.id === state.selectedId;
    });
  }

  // Build a { CATEGORY: count } map from the full (unfiltered) challenge list.
  function getCategoryCounts() {
    return state.challenges.reduce(function (counts, challenge) {
      counts[challenge.category] = (counts[challenge.category] || 0) + 1;
      return counts;
    }, {});
  }

  // Check whether the given challenge id has been solved in this browser session.
  function isSolved(id) {
    return state.solvedIds.some(function (solved) {
      return solved.id === id;
    });
  }

  // Return the BEM modifier class for a category (e.g. "challenge-category--web").
  function categoryClass(category) {
    return "challenge-category--" + String(category).toLowerCase();
  }

  // Map internal uppercase category keys to user-friendly display labels.
  function formatCategory(category) {
    var labels = {
      WEB: "Web",
      CRYPTO: "Cryptography",
      FORENSICS: "Forensics",
      PWN: "Pwn",
      REVERSE: "Reverse",
      MISC: "Misc",
      OSINT: "OSINT",
      WELCOME: "Welcome"
    };

    return labels[category] || category;
  }

  // Format a number with locale-aware thousand separators (e.g. 1234 → "1,234").
  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  // Display a feedback message (success/error) in the given DOM node.
  // Adds an "is-success" or "is-error" class for CSS colour styling.
  function setFeedback(node, message, status) {
    if (!node) {
      return;
    }

    node.textContent = message;
    node.classList.remove("is-success", "is-error");
    if (status) {
      node.classList.add("is-" + status);
    }
  }

  // Clear feedback text and remove any status classes from the node.
  function resetFeedback(node) {
    if (!node) {
      return;
    }

    node.textContent = "";
    node.classList.remove("is-success", "is-error");
  }

  function escapeHtml(value) {
    // Minimal escaping is enough here because templated strings are injected with innerHTML.
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}());
