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

  // Keep the last logtime payload so that the extension can ask for it if
  // its listener was attached after the page already fetched the stats.
  var lastLogtimeStats = null;
  var dispatchLogtime = function (stats) {
    lastLogtimeStats = stats;
    document.dispatchEvent(
      new CustomEvent("42_LOGTIME_DATA", { detail: stats }),
    );
  };
  document.addEventListener("42_LOGTIME_REQUEST", function () {
    if (lastLogtimeStats) dispatchLogtime(lastLogtimeStats);
  });

  // Keep the last groups payload so the extension can ask for it when its
  // listener was attached after the page already fetched the profile.
  var lastGroups = null;
  var dispatchGroups = function (payload) {
    lastGroups = payload;
    document.dispatchEvent(
      new CustomEvent("42_GROUPS_DATA", { detail: payload }),
    );
  };
  document.addEventListener("42_GROUPS_REQUEST", function () {
    if (lastGroups) dispatchGroups(lastGroups);
  });

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

    if (url.indexOf("/projects/") !== -1 && url.indexOf("cursus_id=") !== -1) {
      var match = url.match(/cursus_id=(\d+)/);
      if (match) {
        var cursusId = match[1];
        try {
          sessionStorage.setItem("ft_active_cursus_id", cursusId);
        } catch (e) {}
        document.dispatchEvent(
          new CustomEvent("42_CURSUS_ID", { detail: cursusId }),
        );
      }
    }

    if (url.indexOf("/locations_stats") !== -1 && response.ok) {
      response
        .clone()
        .json()
        .then(function (json) {
          var stats =
            json && json.locations_stats
              ? json.locations_stats
              : json && json.data && json.data.locations_stats
                ? json.data.locations_stats
                : json && typeof json === "object" && !Array.isArray(json)
                  ? json
                  : null;
          if (stats) {
            dispatchLogtime(stats);
          }
        })
        .catch(function () {});
    }

    if (url.indexOf("/users/") !== -1 && url.indexOf("/campus") !== -1) {
      response
        .clone()
        .json()
        .then(function (data) {
          var primary = Array.isArray(data)
            ? data.find(function (c) {
                return c.is_primary;
              }) || data[0]
            : null;
          if (primary && primary.id) {
            document.dispatchEvent(
              new CustomEvent("42_CAMPUS_DETECTED", {
                detail: String(primary.id),
              }),
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

    // intrapy/profile-v3's API carries the user's groups with their 42 colours
    // (the public API v2 does not), so capture them for the PWA.
    if (
      url.indexOf(".intra.42.fr") !== -1 &&
      url.indexOf("/api/") !== -1 &&
      response.ok
    ) {
      response
        .clone()
        .json()
        .then(function (data) {
          var findGroups = function (node, depth) {
            if (!node || typeof node !== "object" || depth > 4) return null;
            if (Array.isArray(node.groups)) return node.groups;
            for (var key in node) {
              var found = findGroups(node[key], depth + 1);
              if (found) return found;
            }
            return null;
          };
          var groups = findGroups(data, 0);
          if (!groups) return;
          var colored = groups
            .filter(function (g) {
              return (
                g &&
                typeof g.name === "string" &&
                typeof g.color === "string" &&
                /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(g.color.trim())
              );
            })
            .map(function (g) {
              return { name: g.name.trim(), color: g.color.trim() };
            });
          var login =
            (data && typeof data.login === "string" && data.login) ||
            (data.user &&
              typeof data.user.login === "string" &&
              data.user.login) ||
            null;
          if (!colored.length) return;
          dispatchGroups({ login: login, groups: colored });
        })
        .catch(function () {});
    }

    return response;
  };

  setTimeout(function () {
    if (intrapyToken) return;
    var kc = window.keycloak || window._keycloak;
    if (kc && kc.token) {
      var t = "Bearer " + kc.token;
      intrapyToken = t;
      try {
        sessionStorage.setItem("ft_intrapy_token", t);
      } catch (e) {}
      dispatchToken(t);
    }
  }, 2000);
})();
