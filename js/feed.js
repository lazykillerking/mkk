(function () {
  // Placeholder hook for the solve feed; currently marks the component as static-only.
  const feed = document.querySelector("[data-feed]");

  if (!feed) {
    return;
  }

  feed.dataset.mode = "static";
}());
