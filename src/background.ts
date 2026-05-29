chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/about.svg",
    title: "Better Intra",
    message: "Extension loaded!",
  });
});