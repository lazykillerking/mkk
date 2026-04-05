(function () {
  const nav = document.querySelector("[data-nav-root]");

  if (!nav) {
    return;
  }

  const button = nav.querySelector(".nav-toggle");
  const panel = nav.querySelector(".nav-panel");
  const links = nav.querySelectorAll(".nav-link, .user-chip");

  if (!button || !panel) {
    return;
  }

  const closeMenu = function () {
    nav.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  };

  const openMenu = function () {
    nav.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
  };

  button.addEventListener("click", function () {
    if (nav.classList.contains("is-open")) {
      closeMenu();
      return;
    }

    openMenu();
  });

  links.forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", function (event) {
    if (!nav.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 980) {
      closeMenu();
    }
  });
}());
