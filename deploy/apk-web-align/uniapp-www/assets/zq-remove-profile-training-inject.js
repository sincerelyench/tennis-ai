/*! 涨球 我的/Profile：去掉「训练计划」入口与「本周/每周训练」区块；不碰设备/城市 */
(function () {
  if (window.__ZQ_REMOVE_PROFILE_TRAINING__) return;
  window.__ZQ_REMOVE_PROFILE_TRAINING__ = true;

  var MARK = "data-zq-no-profile-training";

  function isPlanHref(href) {
    if (!href) return false;
    var h = String(href).toLowerCase();
    return (
      h.indexOf("/plan") !== -1 ||
      h.indexOf("pages/plan") !== -1 ||
      h.indexOf("#/pages/plan") !== -1
    );
  }

  function textOf(el) {
    return ((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function looksLikePlanLabel(txt) {
    if (!txt) return false;
    return (
      /训练计划/.test(txt) ||
      /Training\s*plan/i.test(txt) ||
      /^Plan$/i.test(txt)
    );
  }

  function looksLikeWeekTraining(txt) {
    if (!txt) return false;
    return (
      /本周训练/.test(txt) ||
      /每周的训练/.test(txt) ||
      /每周训练/.test(txt) ||
      /Training days this week/i.test(txt) ||
      /Weekly training/i.test(txt) ||
      /\d\s*\/\s*7/.test(txt)
    );
  }

  function hide(el, reason) {
    if (!el || el.getAttribute(MARK)) return;
    el.setAttribute(MARK, reason || "1");
    el.style.setProperty("display", "none", "important");
    el.setAttribute("aria-hidden", "true");
  }

  function stripMenuRows(root) {
    var nodes = root.querySelectorAll("a, button, uni-view, view, div, li");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute(MARK)) continue;
      var href =
        el.getAttribute("href") ||
        el.getAttribute("data-href") ||
        el.getAttribute("url") ||
        "";
      var txt = textOf(el);
      // Only remove plan rows — leave devices / city / notifications alone
      if (isPlanHref(href) || (looksLikePlanLabel(txt) && txt.length < 40)) {
        // Prefer hiding the row container if it looks like a settings row
        var row = el.closest("[class*='item'], [class*='row'], [class*='cell'], a, li") || el;
        // Avoid hiding the whole page
        if (row === document.body || (row.children && row.children.length > 12)) continue;
        hide(row, "plan-menu");
      }
    }
  }

  function stripWeekCards(root) {
    var nodes = root.querySelectorAll("uni-view, view, div, section, a");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute(MARK)) continue;
      var txt = textOf(el);
      if (!looksLikeWeekTraining(txt)) continue;
      // Hide the card that contains week training label + strip, not the whole profile
      if (txt.length > 220) continue;
      var card =
        el.closest("[class*='card'], [class*='week'], [class*='stat'], section, a") || el;
      if (card === document.body) continue;
      // Don't hide city editor / settings blocks
      var cardTxt = textOf(card);
      if (/当前位置|Location|设备|Devices|通知|Notifications|帮助|Help/.test(cardTxt) && !/本周训练|Weekly training|weekDays/i.test(cardTxt)) {
        continue;
      }
      hide(card, "week-training");
    }
  }

  function run() {
    var root = document.body || document.documentElement;
    if (!root) return;
    stripMenuRows(root);
    stripWeekCards(root);
  }

  run();
  setInterval(run, 800);
  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("hashchange", run);
  window.addEventListener("popstate", run);
})();
