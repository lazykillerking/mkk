(function () {
  const feed = document.querySelector("[data-feed]");

  if (!feed) {
    return;
  }

  feed.dataset.mode = "static";
}());
