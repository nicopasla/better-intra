(function() {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);
    
    if (url.includes("/locations_stats")) {
      response.clone().json().then(json => {
        const stats = json?.locations_stats || json?.data?.locations_stats || json;
        if (stats) {
          document.dispatchEvent(new CustomEvent("42_LOGTIME_DATA", { detail: stats }));
        }
      }).catch(() => {});
    }
    return response;
  };
})();