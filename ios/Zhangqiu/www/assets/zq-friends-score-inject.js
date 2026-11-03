/*! 涨球 球友：录入比分 → 服务端 pending，对方确认后进排行/UTR */
(function () {
  var MARK = "data-zq-friends-score-inject";
  var KEY = "zq-match-scores-v1";
  var STYLE_ID = "zq-friends-score-style";
  var API = "/tennis/api/friends/scores";
  var ACTION = "/tennis/api/friends/scores/action";

  function isFriendsPage() {
    var href = location.href || "";
    return /pages\/friends\/index/i.test(href) || /#\/pages\/friends/i.test(href) || /\/friends/i.test(href);
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
      lead: Z
        ? "提交后需对方确认，确认后才计入排行与 UTR。"
        : "Scores stay pending until the opponent confirms; then ranking/UTR update.",
      playerA: Z ? "球员 A" : "Player A",
      playerB: Z ? "球员 B" : "Player B",
      phA: Z ? "姓名" : "Name",
      phB: Z ? "姓名" : "Name",
      sets: Z ? "盘分" : "Set scores",
      setN: Z ? "第 {n} 盘" : "Set {n}",
      save: Z ? "提交比分" : "Submit score",
      history: Z ? "比分记录" : "Scores",
      clear: Z ? "清空本地" : "Clear local",
      empty: Z ? "还没有比分（0）" : "No scores yet (0)",
      needNames: Z ? "请填写两位球员姓名" : "Enter both player names",
      distinct: Z ? "两位球员姓名不能相同" : "Names must be different",
      needSets: Z ? "至少填写一盘比分" : "Enter at least one set",
      badSets: Z ? "盘分请用数字，例如 6–4" : "Use numbers like 6–4",
      needWinner: Z ? "请让某一侧赢下更多盘" : "One side must win more sets",
      winner: Z ? "胜者 {name}" : "Winner {name}",
      pending: Z ? "待确认" : "Pending",
      confirmed: Z ? "已确认" : "Confirmed",
      rejected: Z ? "已拒绝" : "Rejected",
      inbox: Z ? "待我确认" : "Awaiting my confirm",
      confirm: Z ? "确认" : "Confirm",
      reject: Z ? "拒绝" : "Reject",
      savedPending: Z ? "已提交，等待对方确认" : "Submitted — waiting for opponent",
      signIn: Z ? "请先登录" : "Please sign in",
    };
    return map[key] || key;
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocal(rows) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
    } catch (e) {}
  }

  function hideSearch() {
    var nodes = document.querySelectorAll(".search, [class*=\"search\"]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.getAttribute(MARK + "-search") === "1") continue;
      if (el.querySelector && (el.querySelector(".search-input") || el.querySelector("input"))) {
        var page = el.closest("[data-page=\"friends\"]") || document.querySelector("[data-page=\"friends\"]");
        if (page && page.contains(el)) {
          el.style.display = "none";
          el.setAttribute(MARK + "-search", "1");
        }
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
      "[" + MARK + "] .ok{color:#0f766e;font-size:12px;margin:6px 0}" +
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
      "[" + MARK + "-hist] .empty{font-size:12px;color:#6b7280;padding:8px 0}" +
      "[" + MARK + "-inbox]{margin:8px 16px;padding:12px;border:1px solid rgba(245,158,11,.35);border-radius:12px;background:#fffbeb}" +
      "[" + MARK + "-inbox] h3{margin:0 0 8px;font-size:14px;font-weight:700}" +
      "[" + MARK + "-inbox] .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}" +
      "[" + MARK + "-inbox] button{height:34px;border:0;border-radius:10px;font-weight:600;font-size:13px}" +
      "[" + MARK + "-inbox] .confirm{background:#0f766e;color:#fff}" +
      "[" + MARK + "-inbox] .reject{background:#f3f4f6;color:#4b5563}";
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusLabel(st) {
    if (st === "pending") return t("pending");
    if (st === "rejected") return t("rejected");
    return t("confirmed");
  }

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: "include" }, opts || {})).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data };
      }).catch(function () {
        return { res: res, data: {} };
      });
    });
  }

  function refreshLists() {
    try {
      window.dispatchEvent(new CustomEvent("zq-scores-updated"));
    } catch (e) {}
    // Soft-reload ladder blocks if present
    var ladder = document.querySelector("[data-ladder]");
    if (ladder) ladder.setAttribute("data-ladder-refresh", String(Date.now()));
  }

  var state = { rows: [], pendingForMe: [], notice: "", error: "" };

  function renderInbox(host) {
    host.innerHTML = "";
    if (!state.pendingForMe.length) {
      host.style.display = "none";
      return;
    }
    host.style.display = "";
    host.innerHTML = "<h3>" + t("inbox") + "</h3>";
    state.pendingForMe.forEach(function (row) {
      var item = document.createElement("div");
      item.className = "item";
      item.setAttribute("data-score-pending-row", row.id);
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
        escapeHtml(t("pending")) +
        "</div>" +
        '<div class="actions">' +
        '<button type="button" class="reject" data-reject="' +
        escapeHtml(row.id) +
        '">' +
        t("reject") +
        "</button>" +
        '<button type="button" class="confirm" data-confirm="' +
        escapeHtml(row.id) +
        '">' +
        t("confirm") +
        "</button></div>";
      host.appendChild(item);
    });
    host.querySelectorAll("[data-confirm]").forEach(function (btn) {
      btn.onclick = function () {
        act(btn.getAttribute("data-confirm"), "confirm");
      };
    });
    host.querySelectorAll("[data-reject]").forEach(function (btn) {
      btn.onclick = function () {
        act(btn.getAttribute("data-reject"), "reject");
      };
    });
  }

  function renderHistory(host) {
    var rows = state.rows;
    host.innerHTML = "";
    var head = document.createElement("div");
    head.className = "head";
    head.innerHTML = "<h3>" + t("history") + "</h3>";
    host.appendChild(head);
    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.setAttribute("data-score-empty-count", "0");
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
      item.setAttribute("data-score-status", row.status || "confirmed");
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
        escapeHtml(statusLabel(row.status || "confirmed")) +
        "</div>";
      card.appendChild(item);
    }
    host.appendChild(card);
  }

  function mapApi(row) {
    return {
      id: row.id,
      savedAt: row.confirmedAt || row.createdAt || "",
      playerA: row.playerA,
      playerB: row.playerB,
      sets: row.sets,
      winner: row.winner,
      status: row.status || "pending",
      opponentName: row.opponentName,
    };
  }

  function pull() {
    return api(API).then(function (r) {
      if (!r.res.ok) {
        state.rows = loadLocal();
        state.pendingForMe = [];
        return;
      }
      var pending = (r.data.pendingForMe || []).map(mapApi);
      var mine = (r.data.minePending || []).map(mapApi);
      var confirmed = (r.data.confirmed || []).map(mapApi);
      state.pendingForMe = pending;
      state.rows = pending.concat(mine).concat(confirmed);
      saveLocal(state.rows);
    });
  }

  function act(id, action) {
    api(ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, action: action }),
    }).then(function (r) {
      if (!r.res.ok) {
        state.error = r.data.error || t("signIn");
      } else {
        state.notice = action === "confirm" ? t("confirmed") : t("rejected");
        state.error = "";
      }
      return pull().then(function () {
        var inbox = document.querySelector("[" + MARK + "-inbox]");
        var hist = document.querySelector("[" + MARK + "-hist]");
        if (inbox) renderInbox(inbox);
        if (hist) renderHistory(hist);
        refreshLists();
      });
    });
  }

  function mount() {
    if (!isFriendsPage()) return;
    ensureStyle();
    hideSearch();
    if (document.querySelector("[" + MARK + "]")) return;

    var page = document.querySelector("[data-page=\"friends\"]") || document.querySelector("uni-page-body") || document.body;
    var inbox = document.createElement("section");
    inbox.setAttribute(MARK + "-inbox", "true");
    inbox.style.display = "none";

    var box = document.createElement("section");
    box.setAttribute(MARK, "true");
    box.setAttribute("data-score-entry", "true");
    box.setAttribute("data-score-confirm", "true");
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
      '<p class="ok" data-score-notice hidden></p>' +
      '<button type="button" class="save" data-score-save="true">' +
      t("save") +
      "</button>";

    var hist = document.createElement("section");
    hist.setAttribute(MARK + "-hist", "true");
    hist.setAttribute("data-score-history", "true");

    var ladder = page.querySelector("[data-ladder]");
    if (ladder && ladder.parentNode) {
      ladder.parentNode.insertBefore(inbox, ladder);
      ladder.parentNode.insertBefore(box, ladder);
      ladder.parentNode.insertBefore(hist, ladder);
    } else {
      page.insertBefore(hist, page.firstChild);
      page.insertBefore(box, hist);
      page.insertBefore(inbox, box);
    }

    var err = box.querySelector("[data-score-error]");
    var notice = box.querySelector("[data-score-notice]");
    box.querySelector("[data-score-save]").onclick = function () {
      var aName = (box.querySelector('[data-score-player="a"]').value || "").trim();
      var bName = (box.querySelector('[data-score-player="b"]').value || "").trim();
      err.hidden = true;
      notice.hidden = true;
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
      if (!winnerFromSets(sets)) {
        err.textContent = t("needWinner");
        err.hidden = false;
        return;
      }
      api(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerA: aName, playerB: bName, sets: sets, format: "singles" }),
      }).then(function (r) {
        if (!r.res.ok) {
          err.textContent = r.data.error || t("signIn");
          err.hidden = false;
          return;
        }
        notice.textContent = t("savedPending");
        notice.hidden = false;
        box.querySelector('[data-score-player="b"]').value = "";
        for (var i = 1; i <= 3; i++) {
          box.querySelector('[data-a="' + i + '"]').value = "";
          box.querySelector('[data-b="' + i + '"]').value = "";
        }
        return pull().then(function () {
          renderInbox(inbox);
          renderHistory(hist);
          refreshLists();
        });
      });
    };

    pull().then(function () {
      renderInbox(inbox);
      renderHistory(hist);
    });
  }

  function tick() {
    try {
      mount();
      hideSearch();
    } catch (e) {}
  }

  tick();
  setInterval(tick, 800);
  document.addEventListener("DOMContentLoaded", tick);
  window.addEventListener("hashchange", tick);
  window.addEventListener("popstate", tick);
})();
