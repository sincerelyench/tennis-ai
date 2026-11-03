/*! 涨球：我的/设置去掉「设备」入口；/devices 与 uniapp device 页回我的 */
(function () {
  if (window.__ZQ_REMOVE_DEVICES_INJECT__) return;
  window.__ZQ_REMOVE_DEVICES_INJECT__ = true;

  var MARK = "data-zq-hide-devices";

  function zh() {
    try {
      var lang = (document.documentElement.lang || "").toLowerCase();
      if (lang.indexOf("zh") === 0) return true;
      var stored = localStorage.getItem("zq-locale") || localStorage.getItem("locale") || "";
      return String(stored).toLowerCase().indexOf("zh") === 0;
    } catch (e) {
      return true;
    }
  }

  function path() {
    return (location.pathname || "") + (location.hash || "");
  }

  function isDeviceRoute() {
    var p = path();
    return (
      /\/devices(?:\/|$|\?)/.test(p) ||
      /#\/pages\/device\b/.test(p) ||
      /\/pages\/device\//.test(p)
    );
  }

  function goMe() {
    try {
      if (/\/tennis/.test(location.pathname || "")) {
        location.replace("/tennis/");
        return;
      }
      if (typeof location.hash === "string" && location.hash.indexOf("#/pages/") === 0) {
        location.hash = "#/pages/profile/index";
        return;
      }
      location.replace("/");
    } catch (e) {}
  }

  function looksDevicesLabel(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    if (t === "设备" || t === "Devices" || t === "Device") return true;
    if (/^设备$/.test(t)) return true;
    if (/^Devices$/i.test(t)) return true;
    return false;
  }

  function hideNode(el) {
    if (!el || el.getAttribute(MARK) === "1") return;
    el.setAttribute(MARK, "1");
    el.style.setProperty("display", "none", "important");
    el.setAttribute("aria-hidden", "true");
  }

  function hideDevicesEntries(root) {
    var scope = root || document;
    var anchors = scope.querySelectorAll("a[href], [role='link']");
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute("href") || "";
      if (
        href === "/devices" ||
        href.indexOf("/devices?") === 0 ||
        href.indexOf("/tennis/devices") >= 0 ||
        href.indexOf("/pages/device/") >= 0 ||
        href.indexOf("#/pages/device") >= 0
      ) {
        hideNode(a.closest("a, li, [class*='row'], [class*='item'], [class*='menu'], button") || a);
        continue;
      }
      if (looksDevicesLabel(a.textContent) && /device/i.test(href || a.getAttribute("data-href") || "")) {
        hideNode(a.closest("a, li, [class*='row'], [class*='item'], [class*='menu'], button") || a);
      }
    }

    // uni-app profile settings rows often use plain views + text
    var nodes = scope.querySelectorAll("div, li, button, span, p");
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      if (!n || n.children.length > 3) continue;
      if (!looksDevicesLabel(n.textContent)) continue;
      var row = n.closest("[class*='item'], [class*='row'], [class*='cell'], [class*='menu'], a, li, button") || n;
      var rowText = String(row.textContent || "").replace(/\s+/g, " ").trim();
      if (rowText === "设备" || rowText === "Devices" || /^设备/.test(rowText) && rowText.length < 12) {
        hideNode(row);
      }
    }
  }

  function tick() {
    if (isDeviceRoute()) {
      goMe();
      return;
    }
    hideDevicesEntries(document);
  }

  function boot() {
    tick();
    try {
      var obs = new MutationObserver(function () {
        tick();
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    setInterval(tick, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
