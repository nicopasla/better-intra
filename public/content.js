(function () {
  var hook = document.createElement("script");
  hook.src = chrome.runtime.getURL("hook.js");
  (document.head || document.documentElement).appendChild(hook);
  hook.remove();

  import(chrome.runtime.getURL("content-app.js")).catch(function (e) {
    console.error("Better Intra: failed to load the content app", e);
  });
})();
