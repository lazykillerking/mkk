(function () {
  // Client-side challenge board with localStorage-backed persistence.
  // Everything on the page is derived from this in-memory state object.
  var STORAGE_KEY = "mkk_ctf_challenges_static";
  var SOLVED_KEY = "mkk_ctf_challenges_solved";
  // Password is verified by comparing its SHA-256 hash in the browser.
  var AUTH_HASH = "8de672822d18a05bf095a61b3c3910c7503d89dc91d4beccab96b8d1d002d319";
  var CATEGORIES = ["WEB", "CRYPTO", "FORENSICS", "PWN", "REVERSE", "MISC", "OSINT", "WELCOME"];
  var DEFAULT_CHALLENGES = [
    {
      id: "1",
      name: "Baby XSS",
      description: "Find the reflected XSS in the search page and steal the admin cookie.",
      category: "WEB",
      author: "h4ck3r",
      points: 100,
      difficulty: "Easy",
      hints: ["Check the search parameter.", "Try injecting script tags."],
      solves: 42,
      fileName: "challenge.zip",
      flag: "MKK{baby_xss_reflection}"
    },
    {
      id: "2",
      name: "RSA Basics",
      description: "An RSA-encrypted message was intercepted. The public key looks weak. Recover the plaintext.",
      category: "CRYPTO",
      author: "cryptomaster",
      points: 200,
      difficulty: "Medium",
      hints: ["Factor the modulus.", "Double-check the chosen public exponent."],
      solves: 28,
      fileName: "rsa.txt",
      flag: "MKK{weak_rsa_falls_fast}"
    },
    {
      id: "3",
      name: "Hidden in Plain Sight",
      description: "There is something buried inside the image. Recover the hidden flag.",
      category: "FORENSICS",
      author: "steg0",
      points: 150,
      difficulty: "Easy",
      hints: ["Try steganography tooling.", "Inspect bit planes or LSB data."],
      solves: 35,
      fileName: "",
      flag: "MKK{lsb_whispers_truth}"
    },
    {
      id: "4",
      name: "Buffer Overflow 101",
      description: "Classic stack smash. Control execution and pivot to the flag routine.",
      category: "PWN",
      author: "pwnz0r",
      points: 300,
      difficulty: "Hard",
      hints: ["Measure the offset carefully.", "Watch the calling convention."],
      solves: 12,
      fileName: "vuln",
      flag: "MKK{saved_rip_controlled}"
    },
    {
      id: "5",
      name: "CrackMe",
      description: "Reverse engineer the binary and recover the password validation logic.",
      category: "REVERSE",
      author: "re_ninja",
      points: 250,
      difficulty: "Medium",
      hints: ["Open it in a decompiler.", "Track the string comparison path."],
      solves: 18,
      fileName: "crackme",
      flag: "MKK{reverse_me_softly}"
    },
    {
      id: "6",
      name: "Base64 Madness",
      description: "Decode a chain of encoded blobs until the final flag appears.",
      category: "MISC",
      author: "encoder",
      points: 50,
      difficulty: "Easy",
      hints: ["It is encoded more than once."],
      solves: 67,
      fileName: "",
      flag: "MKK{decode_until_clear}"
    },
    {
      id: "7",
      name: "Find the Hacker",
      description: "Identify the real person behind the alias gh0st_sh4dow using open-source trails.",
      category: "OSINT",
      author: "detective",
      points: 200,
      difficulty: "Medium",
      hints: ["Start with social platforms.", "Reuse usernames across public footprints."],
      solves: 22,
      fileName: "",
      flag: "MKK{aliases_leave_tracks}"
    },
    {
      id: "8",
      name: "Welcome to MKK CTF",
      description: "Warm-up challenge. Submit the intro flag: MKK{w3lc0m3_t0_th3_g4m3}.",
      category: "WELCOME",
      author: "admin",
      points: 10,
      difficulty: "Easy",
      hints: ["Read the description carefully."],
      solves: 150,
      fileName: "",
      flag: "MKK{w3lc0m3_t0_th3_g4m3}"
    }
  ];

  var state = {
    // App state tracks challenge data, filters, current selection, and admin UI state.
    challenges: loadChallenges(),
    solvedIds: loadSolvedIds(),
    category: "ALL",
    search: "",
    selectedId: null,
    adminOpen: false,
    authOpen: false
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
    modalFlagInput: document.querySelector(".challenge-modal__flag input"),
    authModal: document.getElementById("challenge-auth-modal"),
    authForm: document.getElementById("challenge-auth-form"),
    authInput: document.getElementById("challenge-auth-input"),
    authFeedback: document.getElementById("challenge-auth-feedback")
  };

  if (!nodes.grid || !nodes.filters || !nodes.modal || !nodes.authModal) {
    return;
  }

  populateAdminCategories();
  bindEvents();
  render();

  function loadChallenges() {
    // Restore locally edited challenge data; fall back to bundled seed content.
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Unable to access local challenge storage.", error);
    }

    return DEFAULT_CHALLENGES.slice();
  }

  function saveChallenges() {
    // Persist the whole challenge array after admin edits or successful solves.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.challenges));
    } catch (error) {
      console.warn("Unable to persist challenge storage.", error);
    }
  }

  // Solved challenge ids are stored separately so we can preserve solve state
  // without mutating the original challenge definitions too aggressively.
  function loadSolvedIds() {
    try {
      var stored = window.localStorage.getItem(SOLVED_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Unable to access solved challenge state.", error);
    }

    return [];
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
        if (state.adminOpen) {
          state.adminOpen = false;
          renderAdminVisibility();
          return;
        }

        openAuthModal();
      });
    }

    if (nodes.adminForm) {
      // New challenges are created entirely on the client and stored in localStorage.
      nodes.adminForm.addEventListener("submit", function (event) {
        event.preventDefault();

        var formData = new FormData(nodes.adminForm);
        var challenge = {
          id: String(Date.now()),
          name: String(formData.get("name") || "").trim(),
          description: String(formData.get("description") || "").trim(),
          category: String(formData.get("category") || "WEB").trim(),
          author: String(formData.get("author") || "").trim(),
          points: Number(formData.get("points") || 0),
          difficulty: String(formData.get("difficulty") || "Easy").trim(),
          hints: String(formData.get("hints") || "")
            .split(/\r?\n/)
            .map(function (hint) {
              return hint.trim();
            })
            .filter(Boolean),
          solves: Number(formData.get("solves") || 0),
          fileName: String(formData.get("fileName") || "").trim(),
          flag: String(formData.get("flag") || "").trim()
        };

        state.challenges.unshift(challenge);
        saveChallenges();
        nodes.adminForm.reset();
        if (nodes.adminCategory) {
          nodes.adminCategory.value = "WEB";
        }
        render();
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
        state.solvedIds = state.solvedIds.filter(function (solvedId) {
          return solvedId !== id;
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

    // Close the auth modal when its backdrop or × button is clicked.
    nodes.authModal.addEventListener("click", function (event) {
      if (event.target.hasAttribute("data-auth-close")) {
        closeAuthModal();
      }
    });

    if (nodes.authForm) {
      nodes.authForm.addEventListener("submit", function (event) {
        event.preventDefault();
        unlockAdminMode();
      });
    }

    // Global Escape key handler dismisses whichever modal is currently open.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
        closeAuthModal();
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

    state.solvedIds.push(challenge.id);
    challenge.solves += 1;
    saveSolvedIds();
    saveChallenges();
    render();
    if (nodes.modalFlagInput) {
      nodes.modalFlagInput.value = "";
    }
    setFeedback(nodes.modalFeedback, "Flag accepted. Challenge solved.", "success");
  }

  // Display the admin authentication modal and auto-focus the password input.
  // A short setTimeout ensures focus fires after the element becomes visible.
  function openAuthModal() {
    state.authOpen = true;
    nodes.authModal.hidden = false;
    resetFeedback(nodes.authFeedback);
    if (nodes.authInput) {
      nodes.authInput.value = "";
      window.setTimeout(function () {
        nodes.authInput.focus();
      }, 20);
    }
  }

  // Hide the admin auth modal and clear any error feedback text.
  function closeAuthModal() {
    state.authOpen = false;
    nodes.authModal.hidden = true;
    resetFeedback(nodes.authFeedback);
  }

  function unlockAdminMode() {
    // Admin auth is local-only obfuscation, not a secure server-backed permission system.
    var password = nodes.authInput ? String(nodes.authInput.value || "") : "";

    hashPassword(password).then(function (hash) {
      if (hash !== AUTH_HASH) {
        setFeedback(nodes.authFeedback, "Incorrect password.", "error");
        return;
      }

      state.adminOpen = true;
      renderAdminVisibility();
      closeAuthModal();
    });
  }

  // Web Crypto keeps the comparison out of plain-text UI logic.
  function hashPassword(value) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest("SHA-256", new window.TextEncoder().encode(value)).then(function (buffer) {
        return Array.from(new Uint8Array(buffer)).map(function (item) {
          return item.toString(16).padStart(2, "0");
        }).join("");
      });
    }

    return Promise.resolve(value);
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
    return state.solvedIds.indexOf(id) !== -1;
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
