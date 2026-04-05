(function () {
  // Kicks off the initial bar animations for any element with data-bar-width.
  const bars = document.querySelectorAll("[data-bar-width]");

  bars.forEach(function (bar, index) {
    // Staggering the timeout keeps multiple bars from animating in perfect sync.
    const target = bar.getAttribute("data-bar-width") + "%";
    bar.style.setProperty("--bar-target", target);

    window.setTimeout(function () {
      bar.classList.add("is-animating");
    }, 160 + index * 120);
  });
}());
