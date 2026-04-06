(function () {
  // Expose it globally so modules can animate elements on demand after hydration.
  window.runCountUp = function(node) {
    const target = Number(node.getAttribute("data-countup"));
    const prefix = node.getAttribute("data-prefix") || "";
    const duration = 900;
    const start = performance.now();

    const easeOutCubic = function (t) {
      // Fast start, slow finish gives counters a more polished feel.
      return 1 - Math.pow(1 - t, 3);
    };

    const update = function (now) {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.round(target * easeOutCubic(progress));
      const formatted = Number.isInteger(target) ? value.toLocaleString() : String(value);
      node.textContent = prefix + formatted;

      if (progress < 1) {
        window.requestAnimationFrame(update);
      }
    };

    window.requestAnimationFrame(update);
  };

  // Animate any element that declares a numeric data-countup target on initial load.
  const nodes = document.querySelectorAll("[data-countup]");
  if (nodes.length) {
    nodes.forEach(function (node) {
      window.runCountUp(node);
    });
  }
}());
