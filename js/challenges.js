(function () {
  var STORAGE_KEY = "mkk_ctf_challenges_static";
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
      fileName: "challenge.zip"
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
      fileName: "rsa.txt"
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
      fileName: ""
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
      fileName: "vuln"
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
      fileName: "crackme"
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
      fileName: ""
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
      fileName: ""
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
      fileName: ""
    }
  ];

  var state = {
    challenges: loadChallenges(),
    category: "ALL",
    search: "",
    selectedId: null,
    adminOpen: false
  };

  var nodes = {
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
    modalHints: document.getElementById("challenge-modal-hints")
  };

  if (!nodes.grid || !nodes.filters || !nodes.modal) {
    return;
  }

  populateAdminCategories();
  bindEvents();
  render();

  function loadChallenges() {
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
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.challenges));
    } catch (error) {
      console.warn("Unable to persist challenge storage.", error);
    }
  }

  function bindEvents() {
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
          fileName: String(formData.get("fileName") || "").trim()
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
      var card = event.target.closest("[data-challenge-id]");

      if (!card) {
        return;
      }

      openModal(card.getAttribute("data-challenge-id"));
    });

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
      nodes.adminList.addEventListener("click", function (event) {
        var button = event.target.closest("[data-remove-id]");

        if (!button) {
          return;
        }

        var id = button.getAttribute("data-remove-id");
        state.challenges = state.challenges.filter(function (challenge) {
          return challenge.id !== id;
        });

        if (state.selectedId === id) {
          closeModal();
        }

        saveChallenges();
        render();
      });
    }

    nodes.modal.addEventListener("click", function (event) {
      if (event.target.hasAttribute("data-modal-close")) {
        closeModal();
      }
    });

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

    var flagForm = nodes.modal.querySelector(".challenge-modal__flag");
    if (flagForm) {
      flagForm.addEventListener("submit", function (event) {
        event.preventDefault();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  function populateAdminCategories() {
    if (!nodes.adminCategory) {
      return;
    }

    nodes.adminCategory.innerHTML = CATEGORIES.map(function (category) {
      return '<option value="' + category + '">' + category + "</option>";
    }).join("");
  }

  function render() {
    renderFilters();
    renderGrid();
    renderStats();
    renderAdminList();
    renderAdminVisibility();
    renderModal();
  }

  function getFilteredChallenges() {
    return state.challenges.filter(function (challenge) {
      var categoryMatch = state.category === "ALL" || challenge.category === state.category;
      var query = state.search;

      if (!query) {
        return categoryMatch;
      }

      var haystack = [
        challenge.name,
        challenge.description,
        challenge.category,
        challenge.author,
        challenge.difficulty
      ].join(" ").toLowerCase();

      return categoryMatch && haystack.indexOf(query) !== -1;
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

  function renderGrid() {
    var filtered = getFilteredChallenges();
    nodes.grid.innerHTML = filtered.map(function (challenge) {
      return (
        '<article class="glass-card challenge-card" tabindex="0" role="button" aria-label="Open ' + escapeHtml(challenge.name) + ' details" data-challenge-id="' + challenge.id + '">' +
          '<div class="challenge-card__head">' +
            buildCategoryBadge(challenge.category) +
            '<span class="challenge-card__meta">' + formatNumber(challenge.points) + " pts</span>" +
          "</div>" +
          "<h3>" + escapeHtml(challenge.name) + "</h3>" +
          '<p class="challenge-card__description">' + escapeHtml(challenge.description) + "</p>" +
          '<div class="challenge-card__footer">' +
            '<span class="challenge-card__difficulty challenge-card__difficulty--' + challenge.difficulty.toLowerCase() + '">' + escapeHtml(challenge.difficulty) + "</span>" +
            '<span class="challenge-card__stats">' + formatNumber(challenge.solves) + " solves</span>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    nodes.empty.hidden = filtered.length !== 0;
  }

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
          '<button class="challenge-admin-remove" type="button" aria-label="Remove challenge" data-remove-id="' + challenge.id + '">x</button>' +
        "</div>"
      );
    }).join("") + "</div>";
  }

  function renderAdminVisibility() {
    if (!nodes.adminPanel || !nodes.adminToggle) {
      return;
    }

    nodes.adminPanel.hidden = !state.adminOpen;
    nodes.adminToggle.setAttribute("aria-pressed", state.adminOpen ? "true" : "false");
  }

  function openModal(id) {
    state.selectedId = id;
    renderModal();
    nodes.modal.hidden = false;
    document.body.classList.add("challenge-modal-open");
  }

  function closeModal() {
    state.selectedId = null;
    nodes.modal.hidden = true;
    document.body.classList.remove("challenge-modal-open");
  }

  function renderModal() {
    var challenge = state.challenges.find(function (entry) {
      return entry.id === state.selectedId;
    });

    if (!challenge) {
      if (nodes.modal) {
        nodes.modal.hidden = true;
      }
      document.body.classList.remove("challenge-modal-open");
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
  }

  function getCategoryCounts() {
    return state.challenges.reduce(function (counts, challenge) {
      counts[challenge.category] = (counts[challenge.category] || 0) + 1;
      return counts;
    }, {});
  }

  function buildCategoryBadge(category) {
    return '<span class="challenge-badge ' + categoryClass(category) + '">' + escapeHtml(category) + "</span>";
  }

  function categoryClass(category) {
    return "challenge-category--" + String(category).toLowerCase();
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}());
