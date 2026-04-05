(function () {
  const bars = document.querySelectorAll("[data-bar-width]");

  bars.forEach(function (bar, index) {
    const target = bar.getAttribute("data-bar-width") + "%";
    bar.style.setProperty("--bar-target", target);

    window.setTimeout(function () {
      bar.classList.add("is-animating");
    }, 160 + index * 120);
  });
}());
