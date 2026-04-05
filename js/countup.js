(function () {
  const nodes = document.querySelectorAll("[data-countup]");

  if (!nodes.length) {
    return;
  }

  const easeOutCubic = function (t) {
    return 1 - Math.pow(1 - t, 3);
  };

  nodes.forEach(function (node) {
    const target = Number(node.getAttribute("data-countup"));
    const prefix = node.getAttribute("data-prefix") || "";
    const duration = 900;
    const start = performance.now();

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
  });
}());
