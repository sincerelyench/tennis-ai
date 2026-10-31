/*! 涨球 球友：去掉搜索残留 + 录入比分（uni-app www / APK / IPA） */
(function () {
  var MARK = "data-zq-friends-score-inject";
  var KEY = "zq-match-scores-v1";
  var STYLE_ID = "zq-friends-score-style";

  function isFriendsPage() {
    var href = location.href || "";
    return /pages\/friends\/index/i.test(href) || /#\/pages\/friends/i.test(href);
  }

  function zh() {
    try {
      var loc = localStorage.getItem("tennis-locale") || "";
      if (loc === "en") return false;
      if (loc === "zh") return true;
    } catch (e) {}
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0;
  }

  function t(key) {
    var Z = zh();
    var map = {
      title: Z ? "录入比分" : "Enter score",
      lead: Z ? "记下球员名和盘分，保存在本机历史。" : "Save player names and set scores on this device.",
      playerA: Z ? "球员 A" : "Player A",
      playerB: Z ? "球员 B" : "Player B",
      phA: Z ? "姓名" : "Name",
      phB: Z ? "姓名" : "Name",
      sets: Z ? "盘分" : "Set scores",
      setN: Z ? "第 {n} 盘" : "Set {n}",
      save: Z ? "保存比分" : "Save score",
      history: Z ? "本机比分" : "Saved scores",
      clear: Z ? "清空" : "Clear",
      empty: Z ? "还没有保存的比分" : "No saved scores yet",
      needNames: Z ? "请填写两位球员姓名" : "Enter both player names",
      distinct: Z ? "两位球员姓名不能相同" : "Names must be different",
      needSets: Z ? "至少填写一盘比分" : "Enter at least one set",
      badSets: Z ? "盘分请用数字，例如 6–4" : "Use numbers like 6–4",
      needWinner: Z ? "请让某一侧赢下更多盘" : "One side must win more sets",
      winner: Z ? "胜者 {name}" : "Winner {name}",
    };
    return map[key] || key;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function save(rows) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rows));
    } catch (e) {}
  }

  function hideSearch() {
    var nodes = document.querySelectorAll(".search, [class*=\"search\"]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.getAttribute(MARK + "-search") === "1") continue;
      // Only hide the friends search row (icon + input), not device search elsewhere
      if (el.querySelector && (el.querySelector(".search-input") || el.querySelector("input"))) {
        var page = el.closest("[data-page=\"friends\"]") || document.querySelector("[data-page=\"friends\"]");
        if (page && page.contains(el)) {
          el.style.display = "none";
          el.setAttribute(MARK + "-search", "1");
        }
      }
    }
    // Also hide empty searchPh inputs that still render
    var inputs = document.querySelectorAll("[data-page=\"friends\"] input, .uni-input-input");
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j];
      var ph = (inp.getAttribute("placeholder") || inp.placeholder || "").trim();
      if (/搜索球友|搜索球场|Search friends|Search courts/i.test(ph)) {
        var wrap = inp.closest(".search") || inp.parentElement;
        if (wrap) {
          wrap.style.display = "none";
          wrap.setAttribute(MARK + "-search", "1");
        }
      }
    }
  }

  function fixNtrpLabels() {
    var root = document.querySelector("[data-page=\"friends\"]");
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && /NTRP/.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(/NTRP/g, "UTR");
      }
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "[" + MARK + "]{margin:12px 16px 8px;padding:14px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff}" +
      "[" + MARK + "] h3{margin:0;font-size:14px;font-weight:700}" +
      "[" + MARK + "] .lead{margin:6px 0 12px;font-size:12px;color:#6b7280;line-height:1.5}" +
      "[" + MARK + "] .row{display:flex;gap:8px;margin-bottom:8px}" +
      "[" + MARK + "] label{flex:1;display:flex;flex-direction:column;gap:4px;font-size:11px;color:#6b7280}" +
      "[" + MARK + "] input{height:36px;border:1px solid #d1d5db;border-radius:10px;padding:0 10px;font-size:14px}" +
      "[" + MARK + "] .set-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}" +
      "[" + MARK + "] .set-row span{width:52px;font-size:11px;color:#6b7280}" +
      "[" + MARK + "] .set-row input{flex:1;text-align:center}" +
      "[" + MARK + "] .err{color:#b91c1c;font-size:12px;margin:6px 0}" +
      "[" + MARK + "] button.save{width:100%;height:36px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-weight:600;font-size:14px}" +
      "[" + MARK + "-hist]{margin:8px 16px 16px}" +
      "[" + MARK + "-hist] .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}" +
      "[" + MARK + "-hist] h3{margin:0;font-size:14px;font-weight:700}" +
      "[" + MARK + "-hist] .clear{border:0;background:none;color:#6b7280;font-size:11px;text-decoration:underline}" +
      "[" + MARK + "-hist] .card{border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff;overflow:hidden}" +
      "[" + MARK + "-hist] .item{padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.06)}" +
      "[" + MARK + "-hist] .item:last-child{border-bottom:0}" +
      "[" + MARK + "-hist] .name{font-size:14px;font-weight:600}" +
      "[" + MARK + "-hist] .meta{font-size:12px;color:#6b7280;margin-top:2px}" +
      "[" + MARK + "-hist] .empty{font-size:12px;color:#6b7280;padding:8px 0}";
    document.head.appendChild(s);
  }

  function parsePair(a, b) {
    var ga = Number(a);
    var gb = Number(b);
    if (!isFinite(ga) || !isFinite(gb)) return null;
    if (ga < 0 || gb < 0 || ga > 99 || gb > 99) return null;
    if (ga === 0 && gb === 0) return null;
    return [Math.floor(ga), Math.floor(gb)];
  }

  function winnerFromSets(sets) {
    var wa = 0;
    var wb = 0;
    for (var i = 0; i < sets.length; i++) {
      if (sets[i][0] === sets[i][1]) continue;
      if (sets[i][0] > sets[i][1]) wa++;
      else wb++;
    }
    if (wa === wb) return null;
    return wa > wb ? "A" : "B";
  }

  function formatSets(sets) {
    return sets
      .map(function (s) {
        return s[0] + "-" + s[1];
      })
      .join(" · ");
  }

  function renderHistory(host) {
    var rows = load();
    host.innerHTML = "";
    var head = document.createElement("div");
    head.className = "head";
    head.innerHTML = "<h3>" + t("history") + "</h3>";
    if (rows.length) {
      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "clear";
      clearBtn.textContent = t("clear");
      clearBtn.onclick = function () {
        save([]);
        renderHistory(host);
      };
      head.appendChild(clearBtn);
    }
    host.appendChild(head);
    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = t("empty");
      host.appendChild(empty);
      return;
    }
    var card = document.createElement("div");
    card.className = "card";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var item = document.createElement("div");
      item.className = "item";
      item.setAttribute("data-score-row", row.id);
      var winnerName = row.winner === "A" ? row.playerA : row.playerB;
      item.innerHTML =
        '<div class="name">' +
        escapeHtml(row.playerA) +
        " vs " +
        escapeHtml(row.playerB) +
        "</div>" +
        '<div class="meta">' +
        escapeHtml(formatSets(row.sets)) +
        "</div>" +
        '<div class="meta">' +
        escapeHtml(t("winner").replace("{name}", winnerName)) +
        " · " +
        escapeHtml((row.savedAt || "").slice(0, 10)) +
        "</div>";
      card.appendChild(item);
    }
    host.appendChild(card);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mount() {
    if (!isFriendsPage()) return;
    ensureStyle();
    hideSearch();
    fixNtrpLabels();
    if (document.querySelector("[" + MARK + "]")) {
      return;
    }
    var page = document.querySelector("[data-page=\"friends\"]") || document.querySelector("uni-page-body") || document.body;
    var box = document.createElement("section");
    box.setAttribute(MARK, "true");
    box.setAttribute("data-score-entry", "true");
    box.innerHTML =
      "<h3>" +
      t("title") +
      "</h3><p class=\"lead\">" +
      t("lead") +
      "</p>" +
      '<div class="row">' +
      "<label>" +
      t("playerA") +
      '<input data-score-player="a" placeholder="' +
      t("phA") +
      '"/></label>' +
      "<label>" +
      t("playerB") +
      '<input data-score-player="b" placeholder="' +
      t("phB") +
      '"/></label></div>' +
      "<div class=\"sets-label\" style=\"font-size:11px;color:#6b7280;margin:4px 0 6px\">" +
      t("sets") +
      "</div>" +
      [1, 2, 3]
        .map(function (n) {
          return (
            '<div class="set-row" data-score-set="' +
            n +
            '"><span>' +
            t("setN").replace("{n}", String(n)) +
            '</span><input inputmode="numeric" data-a="' +
            n +
            '" placeholder="6"/><span>–</span><input inputmode="numeric" data-b="' +
            n +
            '" placeholder="4"/></div>'
          );
        })
        .join("") +
      '<p class="err" data-score-error hidden></p>' +
      '<button type="button" class="save" data-score-save="true">' +
      t("save") +
      "</button>";

    var hist = document.createElement("section");
    hist.setAttribute(MARK + "-hist", "true");
    hist.setAttribute("data-score-history", "true");

    // Insert after title/count if possible, else prepend
    var ladder = page.querySelector("[data-ladder]");
    if (ladder && ladder.parentNode) {
      ladder.parentNode.insertBefore(box, ladder);
      ladder.parentNode.insertBefore(hist, ladder);
    } else {
      page.insertBefore(hist, page.firstChild);
      page.insertBefore(box, hist);
    }

    var err = box.querySelector("[data-score-error]");
    box.querySelector("[data-score-save]").onclick = function () {
      var aName = (box.querySelector('[data-score-player="a"]').value || "").trim();
      var bName = (box.querySelector('[data-score-player="b"]').value || "").trim();
      err.hidden = true;
      if (!aName || !bName) {
        err.textContent = t("needNames");
        err.hidden = false;
        return;
      }
      if (aName === bName) {
        err.textContent = t("distinct");
        err.hidden = false;
        return;
      }
      var sets = [];
      for (var n = 1; n <= 3; n++) {
        var av = box.querySelector('[data-a="' + n + '"]').value;
        var bv = box.querySelector('[data-b="' + n + '"]').value;
        if (!String(av).trim() && !String(bv).trim()) continue;
        var pair = parsePair(av, bv);
        if (!pair) {
          err.textContent = t("badSets");
          err.hidden = false;
          return;
        }
        sets.push(pair);
      }
      if (!sets.length) {
        err.textContent = t("needSets");
        err.hidden = false;
        return;
      }
      var winner = winnerFromSets(sets);
      if (!winner) {
        err.textContent = t("needWinner");
        err.hidden = false;
        return;
      }
      var rows = load();
      rows.unshift({
        id: "s-" + Date.now(),
        savedAt: new Date().toISOString(),
        playerA: aName,
        playerB: bName,
        sets: sets,
        winner: winner,
      });
      save(rows.slice(0, 40));
      box.querySelector('[data-score-player="a"]').value = "";
      box.querySelector('[data-score-player="b"]').value = "";
      for (var i = 1; i <= 3; i++) {
        box.querySelector('[data-a="' + i + '"]').value = "";
        box.querySelector('[data-b="' + i + '"]').value = "";
      }
      renderHistory(hist);
    };

    renderHistory(hist);
  }

  function tick() {
    try {
      mount();
      hideSearch();
      fixNtrpLabels();
    } catch (e) {}
  }

  tick();
  setInterval(tick, 800);
  document.addEventListener("DOMContentLoaded", tick);
  window.addEventListener("hashchange", tick);
  window.addEventListener("popstate", tick);
})();
