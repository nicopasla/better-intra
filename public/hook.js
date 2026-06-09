(function () {
  const originalFetch = window.fetch;
  let intrapyToken = null;

  var getUrl = function (arg) {
    return arg instanceof Request ? arg.url : String(arg);
  };

  var getAuthHeader = function (args) {
    if (args[1]) {
      var h = args[1].headers;
      if (h) {
        if (typeof h.get === "function") {
          var v = h.get("authorization");
          if (v) return v;
        } else {
          if (h.Authorization) return h.Authorization;
          if (h.authorization) return h.authorization;
        }
      }
    }
    if (args[0] instanceof Request) {
      var v = args[0].headers.get("authorization");
      if (v) return v;
    }
    return null;
  };

  var dispatchToken = function (token) {
    document.dispatchEvent(
      new CustomEvent("42_INTRAPY_TOKEN", { detail: token }),
    );
  };

  try {
    var stored = sessionStorage.getItem("ft_intrapy_token");
    if (stored) {
      intrapyToken = stored;
      dispatchToken(stored);
    }
  } catch (e) {}

  window.fetch = async function () {
    var args = arguments;
    var response = await originalFetch.apply(window, args);
    var url = getUrl(args[0]);

    if (url.indexOf("/locations_stats") !== -1) {
      response
        .clone()
        .json()
        .then(function (json) {
          var stats =
            json && json.locations_stats
              ? json.locations_stats
              : json && json.data && json.data.locations_stats
                ? json.data.locations_stats
                : json;
          if (stats) {
            document.dispatchEvent(
              new CustomEvent("42_LOGTIME_DATA", { detail: stats }),
            );
          }
        })
        .catch(function () {});
    }

    if (url.indexOf(".intra.42.fr") !== -1) {
      var auth = getAuthHeader(args);
      if (auth && auth !== intrapyToken) {
        intrapyToken = auth;
        try {
          sessionStorage.setItem("ft_intrapy_token", auth);
        } catch (e) {}
        dispatchToken(auth);
      }
    }

    return response;
  };

  setTimeout(function () {
    if (intrapyToken) return;
    var kc = window.keycloak || window._keycloak;
    if (kc && kc.token) {
      var t = "Bearer " + kc.token;
      intrapyToken = t;
      try { sessionStorage.setItem("ft_intrapy_token", t); } catch (e) {}
      dispatchToken(t);
    }
  }, 2000);
})();
