const params = new URLSearchParams(window.location.search);
const isReminder = params.get("type") === "reminder";

document.getElementById("title").textContent = params.get("title") ?? "";
document.getElementById("message").textContent = params.get("message") ?? "";
document.getElementById("time").textContent = params.get("time") ?? "";
document
  .getElementById("dismiss")
  .addEventListener("click", () => window.close());

const icon = document.getElementById("icon");
const badge = document.getElementById("badge");
const iconGlyph = document.getElementById("icon-glyph");

if (isReminder) {
  icon.classList.add("reminder");
  iconGlyph.className = "ti ti-bell-ringing";
  badge.className = "popup-badge reminder";
  badge.textContent = "Starting soon";

  const user = params.get("user");
  const link = params.get("link");
  if (user && link) {
    const userLink = document.getElementById("user-link");
    userLink.href = link;
    userLink.style.display = "block";
    document.getElementById("user-name").textContent = user;
    document.getElementById("user-avatar").textContent = user
      .slice(0, 2)
      .toUpperCase();
  }
} else {
  icon.classList.add("booking");
  iconGlyph.className = "ti ti-calendar-plus";
  badge.className = "popup-badge booking";
  badge.textContent = "New booking";
}

window.addEventListener("load", () => {
  const height = document.body.scrollHeight;
  chrome.windows.getCurrent((win) => {
    chrome.windows.update(win.id, {
      width: 360,
      height: height + 40,
    });
  });
});

window.addEventListener("load", () => {
  const height = document.body.scrollHeight;
  chrome.windows.getCurrent((win) => {
    chrome.windows.update(win.id, {
      width: 360,
      height: height + 40,
    });
  });
});

window.addEventListener("resize", () => {
  const height = document.body.scrollHeight;
  chrome.windows.getCurrent((win) => {
    chrome.windows.update(win.id, {
      width: 360,
      height: height + 40,
    });
  });
});
