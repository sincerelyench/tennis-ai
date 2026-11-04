/*! 涨球 我的/Profile：去掉训练时长/球友个数/分析个数统计条，以及练的最多/最近趋势卡片 */
(function () {
  if (window.__ZQ_REMOVE_PROFILE_STATS__) return;
  window.__ZQ_REMOVE_PROFILE_STATS__ = true;

  var MARK = "data-zq-no-profile-stats";

  function textOf(el) {
    return ((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function hide(el, reason) {
    if (!el || el.getAttribute(MARK)) return;
    el.setAttribute(MARK, reason || "1");
    el.style.setProperty("display", "none", "important");
    el.setAttribute("aria-hidden", "true");
  }

  function looksLikeStatStrip(txt) {
    if (!txt) return false;
    var hasHours = /训练时长|Training\s*(time|duration|hours)/i.test(txt);
    var hasFriends = /球友(个数|数)?|Friends?/i.test(txt);
    var hasAnalyses = /分析(个数|次数|数)?|Analyses?/i.test(txt);
    var hits = (hasHours ? 1 : 0) + (hasFriends ? 1 : 0) + (hasAnalyses ? 1 : 0);
    return hits >= 2;
  }

  function looksLikeTrendOrMost(txt) {
    if (!txt) return false;
    return (
      /练[的得]最多|Most\s*practiced/i.test(txt) ||
      /最近趋势|近期等级走势|Recent\s*(grade\s*)?trend/i.test(txt)
    );
  }

  function stripStats(root) {
    // Uni-app classic .stats row
    var stats = root.querySelectorAll(".stats, [class*='stats']");
    for (var i = 0; i < stats.length; i++) {
      var el = stats[i];
      if (el.getAttribute(MARK)) continue;
      var txt = textOf(el);
      if (looksLikeStatStrip(txt) || (el.classList && el.classList.contains("stats"))) {
        // Don't hide city/settings
        if (/当前位置|Location|设置|Settings|通知|Notifications/i.test(txt) && !looksLikeStatStrip(txt)) {
          continue;
        }
        if (txt.length < 180 || looksLikeStatStrip(txt)) {
          hide(el, "stats-strip");
        }
      }
    }

    // Next/web 3-col strip by label match
    var nodes = root.querySelectorAll("div, section, uni-view, view");
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      if (n.getAttribute(MARK)) continue;
      var t = textOf(n);
      if (!looksLikeStatStrip(t)) continue;
      if (t.length > 220) continue;
      if (/当前位置|显示名|Display name|Location/i.test(t) && t.length > 120) continue;
      hide(n, "stats-strip");
    }
  }

  function stripTrendCards(root) {
    var nodes = root.querySelectorAll(".card, div, section, uni-view, view");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute(MARK)) continue;
      var txt = textOf(el);
      if (!looksLikeTrendOrMost(txt)) continue;
      // Prefer the card itself, not the whole my-data section
      if (txt.length > 160) continue;
      if (/成长轨迹|Journey|当前位置|Settings|设置/i.test(txt) && !looksLikeTrendOrMost(txt.split(/\n/)[0] || txt)) {
        continue;
      }
      var card =
        el.closest(".card, [class*='card'], [class*='cols-2'] > *, [class*='grid'] > *") || el;
      if (card === document.body) continue;
      var cardTxt = textOf(card);
      if (cardTxt.length > 200) continue;
      if (/当前位置|显示名|Display name|设置|Settings|通知/i.test(cardTxt)) continue;
      hide(card, "trend-or-most");
    }

    // Empty cols-2 wrapper after both cards gone
    var grids = root.querySelectorAll(".cols-2, [class*='grid-cols-2']");
    for (var g = 0; g < grids.length; g++) {
      var grid = grids[g];
      if (grid.getAttribute(MARK)) continue;
      var kids = Array.prototype.filter.call(grid.children || [], function (c) {
        return c.getAttribute(MARK) !== "trend-or-most" && getComputedStyle(c).display !== "none";
      });
      if (kids.length === 0) hide(grid, "empty-cols");
    }
  }

  function run() {
    var root = document.body || document.documentElement;
    if (!root) return;
    stripStats(root);
    stripTrendCards(root);
  }

  run();
  setInterval(run, 800);
  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("hashchange", run);
  window.addEventListener("popstate", run);
})();
