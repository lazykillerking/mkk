(function () {
  const feed = document.querySelector("[data-feed]");

  if (!feed) {
    return;
  }

  const entries = [
    { user: "lazykillerking", challenge: "Heap Siren", points: 60, time: "00:03 ago", active: true },
    { user: "packetghost", challenge: "Token Mirage", points: 40, time: "00:05 ago", active: false },
    { user: "rootphantom", challenge: "ELF Ritual", points: 80, time: "00:08 ago", active: false },
    { user: "lazykillerking", challenge: "Amber Relay", points: 20, time: "00:11 ago", active: true }
  ];

  const createRow = function (entry) {
    const row = document.createElement("div");
    row.className = "feed-row feed-row--incoming" + (entry.active ? " feed-row--active" : "");
    row.innerHTML = [
      '<span class="feed-check">✔</span>',
      "<span>" + entry.user + "</span>",
      "<span>→</span>",
      "<span>" + entry.challenge + "</span>",
      '<span class="feed-points">+' + entry.points + "</span>",
      '<span class="feed-time">' + entry.time + "</span>"
    ].join("");
    return row;
  };

  let index = 0;
  window.setInterval(function () {
    const row = createRow(entries[index % entries.length]);
    feed.prepend(row);

    while (feed.children.length > 6) {
      feed.removeChild(feed.lastElementChild);
    }

    window.setTimeout(function () {
      row.classList.remove("feed-row--incoming");
    }, 420);

    index += 1;
  }, 3200);
}());
