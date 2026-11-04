/*! 涨球 · 底栏：球友→约球（EN Play），并与教练换位 → 分析 / 约球 / 教练 / 我的 */
(function () {
  if (window.__ZQ_TABS_SWAP_YUEQIU__) return;
  window.__ZQ_TABS_SWAP_YUEQIU__ = true;

  var MARK = "data-zq-tabs-swap-yueqiu";
  var STYLE_ID = "zq-tabs-swap-yueqiu-style";

  function zh() {
    try {
      var lang =
        localStorage.getItem("tennis-ai-locale") ||
        localStorage.getItem("zq-locale") ||
        localStorage.getItem("locale") ||
        (document.documentElement && document.documentElement.lang) ||
        "";
      lang = String(lang).toLowerCase();
      if (lang.indexOf("en") === 0) return false;
      if (lang.indexOf("zh") === 0) return true;
    } catch (e) {}
    return true;
  }

  function labelFriends() {
    return zh() ? "约球" : "Play";
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "[" +
      MARK +
      '-order="friends"]{order:2!important}' +
      "[" +
      MARK +
      '-order="coach"]{order:3!important}' +
      "[" +
      MARK +
      '-order="analysis"]{order:1!important}' +
      "[" +
      MARK +
      '-order="profile"]{order:4!important}' +
      ".tab-inner, .tabbar .tab-inner, [class*='tab-inner']{display:flex!important}";
    document.documentElement.appendChild(s);
  }

  function textOf(el) {
    return ((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function isFriendsTab(el) {
    var t = textOf(el);
    if (/^球友$|^约球$|^Friends$|^Play$/i.test(t)) return true;
    var href =
      el.getAttribute("href") ||
      el.getAttribute("data-href") ||
      el.getAttribute("url") ||
      "";
    if (/friends/i.test(href)) return true;
    if ((el.getAttribute("data-nav-key") || "") === "friends") return true;
    return false;
  }

  function isCoachTab(el) {
    var t = textOf(el);
    if (/^教练$|^Coach$|^AI\s*教练$/i.test(t) && !/网络|选教练|涨球教练/.test(t)) return true;
    var href =
      el.getAttribute("href") ||
      el.getAttribute("data-href") ||
      el.getAttribute("url") ||
      "";
    if (/\/coach(\/|$)|pages\/coach\/index/i.test(href) && !/coach-picker|coaches/i.test(href))
      return true;
    if ((el.getAttribute("data-nav-key") || "") === "coach") return true;
    return false;
  }

  function isAnalysisTab(el) {
    var t = textOf(el);
    if (/^分析$|^视频分析$|^Analyze$/i.test(t)) return true;
    var href =
      el.getAttribute("href") ||
      el.getAttribute("data-href") ||
      el.getAttribute("url") ||
      "";
    return /analysis/i.test(href) || (el.getAttribute("data-nav-key") || "") === "analysis";
  }

  function isProfileTab(el) {
    var t = textOf(el);
    if (/^我的$|^Me$/i.test(t)) return true;
    var href =
      el.getAttribute("href") ||
      el.getAttribute("data-href") ||
      el.getAttribute("url") ||
      "";
    return (
      (el.getAttribute("data-nav-key") || "") === "profile" ||
      /pages\/profile/i.test(href) ||
      href === "/" ||
      href === "/tennis" ||
      href === "/tennis/"
    );
  }

  function renameFriendsLabel(root) {
    var want = labelFriends();
    var nodes = root.querySelectorAll(".tab-label, [class*='tab-label'], span, uni-text, text");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = textOf(el);
      if (t === "球友" || t === "Friends") {
        el.textContent = want;
        el.setAttribute(MARK + "-renamed", "1");
      }
    }
    // Next.js web shell
    var links = root.querySelectorAll('[data-nav-key="friends"] span, a[href*="/friends"] span');
    for (var j = 0; j < links.length; j++) {
      var sp = links[j];
      var tx = textOf(sp);
      if (tx === "球友" || tx === "Friends" || tx === "约球" || tx === "Play") {
        if (tx !== want) sp.textContent = want;
      }
    }
  }

  function reorderTabbar(root) {
    ensureStyle();
    var bars = root.querySelectorAll(".tabbar, [class*='tabbar'], nav[data-mobile-nav='global']");
    for (var b = 0; b < bars.length; b++) {
      var bar = bars[b];
      var inner =
        bar.querySelector(".tab-inner") ||
        bar.querySelector("[class*='tab-inner']") ||
        bar.querySelector(".grid") ||
        bar.firstElementChild ||
        bar;
      if (inner && getComputedStyle(inner).display.indexOf("flex") === -1 && inner.classList) {
        try {
          inner.style.display = "flex";
        } catch (e) {}
      }
      var kids = [];
      var candidates = inner.querySelectorAll(
        ".tab, [class*='tab '], a[data-nav-key], a[href*='/friends'], a[href*='/coach'], a[href*='/analysis']",
      );
      if (!candidates.length) {
        candidates = inner.children;
      }
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (!el || el.nodeType !== 1) continue;
        if (isFriendsTab(el)) {
          el.setAttribute(MARK + "-order", "friends");
          kids.push(el);
        } else if (isCoachTab(el)) {
          el.setAttribute(MARK + "-order", "coach");
          kids.push(el);
        } else if (isAnalysisTab(el)) {
          el.setAttribute(MARK + "-order", "analysis");
        } else if (isProfileTab(el)) {
          el.setAttribute(MARK + "-order", "profile");
        }
      }
      // Physical swap when CSS order is not enough (uni-app)
      var friendsEl = null;
      var coachEl = null;
      var childList = Array.prototype.slice.call(inner.children || []);
      for (var c = 0; c < childList.length; c++) {
        if (isFriendsTab(childList[c])) friendsEl = childList[c];
        if (isCoachTab(childList[c])) coachEl = childList[c];
      }
      if (friendsEl && coachEl) {
        var fi = childList.indexOf(friendsEl);
        var ci = childList.indexOf(coachEl);
        // Desired: friends before coach (analysis, friends, coach, profile)
        if (fi > ci) {
          inner.insertBefore(friendsEl, coachEl);
        }
      }
    }
  }

  function patchI18nDict() {
    try {
      // Best-effort: walk known globals / vue i18n if present
      var want = labelFriends();
      var seen = [];
      function walk(obj, depth) {
        if (!obj || depth > 4 || seen.indexOf(obj) !== -1) return;
        if (typeof obj !== "object") return;
        seen.push(obj);
        try {
          if (obj.nav && typeof obj.nav === "object" && "friends" in obj.nav) {
            if (obj.nav.friends === "球友" || obj.nav.friends === "Friends") {
              obj.nav.friends = want;
            }
          }
          if (obj.friends && typeof obj.friends === "object" && typeof obj.friends.title === "string") {
            if (obj.friends.title === "球友" || obj.friends.title === "Friends") {
              obj.friends.title = want;
            }
          }
          var keys = Object.keys(obj);
          for (var i = 0; i < Math.min(keys.length, 40); i++) {
            walk(obj[keys[i]], depth + 1);
          }
        } catch (e) {}
      }
      walk(window.__ZQ_I18N__, 0);
      walk(window.__UNI_FEATURE_I18N__, 0);
    } catch (e) {}
  }

  function apply(root) {
    root = root || document;
    renameFriendsLabel(root);
    reorderTabbar(root);
    patchI18nDict();
  }

  function boot() {
    apply(document);
    var obs = new MutationObserver(function () {
      apply(document);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    setInterval(function () {
      apply(document);
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
