(function () {
  // This script does two unrelated but shared jobs:
  // 1. Toggle a scrolled style on the fixed header.
  // 2. Drive the countdown pill when the page contains one.
  const countdownNode = document.querySelector("[data-countdown]");
  const header = document.querySelector("[data-scroll-header]");

  if (header) {
    const syncHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };

    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }

  if (!countdownNode) {
    return;
  }

  const targetTime = Date.now() + (((14 * 60 + 23) * 60) + 7) * 1000;
  // The timer is relative to page load, not a fixed event date.

  const pad = function (value) {
    return String(value).padStart(2, "0");
  };

  const render = function () {
    // Clamp at zero so the timer never goes negative after expiry.
    const diff = Math.max(0, targetTime - Date.now());
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdownNode.textContent = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  };

  render();
  window.setInterval(render, 1000);
}());
