(function () {
  // Expose it globally so dynamic elements can trigger it after hydration.
  window.initBars = function(barsElements) {
    if(!barsElements) return;
    barsElements.forEach(function (bar, index) {
      // Staggering the timeout keeps multiple bars from animating in perfect sync.
      const target = bar.getAttribute("data-bar-width") + "%";
      bar.style.setProperty("--bar-target", target);

      window.setTimeout(function () {
        bar.classList.add("is-animating");
      }, 160 + index * 120);
    });
  };

  // Kicks off the initial bar animations for any element with data-bar-width found on load.
  const bars = document.querySelectorAll("[data-bar-width]");
  if(bars.length) {
    window.initBars(bars);
  }
}());
