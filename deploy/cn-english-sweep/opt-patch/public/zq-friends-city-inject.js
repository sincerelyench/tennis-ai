/*! 涨球 球友：城市排行 + 录入比分；隐藏硬编码球友卡片与搜索 */
(function () {
  var MARK = "data-zq-friends-city-inject";
  var SCORE_MARK = "data-zq-friends-score-inject";
  var KEY = "zq-match-scores-v1";
  var CITY_KEY = "zq-friends-city-v1";
  var STYLE_ID = "zq-friends-city-style";
  var GEO_URLS = [
    "https://yqchen.blog/tennis/api/geo/city",
    "/tennis/api/geo/city",
  ];

  var CHINA = [
    ["beijing","北京","Beijing"],["shanghai","上海","Shanghai"],["guangzhou","广州","Guangzhou"],
    ["shenzhen","深圳","Shenzhen"],["hangzhou","杭州","Hangzhou"],["nanjing","南京","Nanjing"],
    ["suzhou","苏州","Suzhou"],["wuxi","无锡","Wuxi"],["chengdu","成都","Chengdu"],
    ["chongqing","重庆","Chongqing"],["wuhan","武汉","Wuhan"],["xian","西安","Xi'an"],
    ["tianjin","天津","Tianjin"],["qingdao","青岛","Qingdao"],["xiamen","厦门","Xiamen"],
    ["changsha","长沙","Changsha"],["zhengzhou","郑州","Zhengzhou"],["hefei","合肥","Hefei"],
    ["ningbo","宁波","Ningbo"],["dongguan","东莞","Dongguan"],["hongkong","香港","Hong Kong"],
    ["taipei","台北","Taipei"]
  ];
  var WORLD = [
    ["newyork","纽约","New York"],["losangeles","洛杉矶","Los Angeles"],["london","伦敦","London"],
    ["paris","巴黎","Paris"],["tokyo","东京","Tokyo"],["seoul","首尔","Seoul"],
    ["singapore","新加坡","Singapore"],["sydney","悉尼","Sydney"],["toronto","多伦多","Toronto"],
    ["dubai","迪拜","Dubai"],["bangkok","曼谷","Bangkok"],["berlin","柏林","Berlin"]
  ];

  var PLAYERS = [];
  var MATCHES = [];


  function loadDirectoryPlayers(done) {
    var urls = [
      "https://yqchen.blog/tennis/api/friends/directory?role=player&includeSelf=1",
      "/tennis/api/friends/directory?role=player&includeSelf=1"
    ];
    var i = 0;
    function next() {
      if (i >= urls.length) { PLAYERS = []; if (done) done([]); return; }
      var url = urls[i++];
      fetch(url, { credentials: "include" }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (data) {
          var users = (data && data.users) || [];
          PLAYERS = users.filter(function (u) { return u && u.displayName; }).map(function (u) {
            return { id: u.id, name: u.displayName, ntrp: u.level || 3.5, cityId: u.cityId || "" };
          });
          try {
            if (data && data.self && data.self.displayName) {
              localStorage.setItem("zq-friends-self-name-v1", data.self.displayName);
              localStorage.setItem("tennis-ai-display-name", data.self.displayName);
            }
          } catch (e) {}
          if (done) done(PLAYERS);
        }).catch(function () { next(); });
    }
    next();
  }

  var state = { cityId: "wuxi", format: "singles", source: "default", ready: false };

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

  function cityOptions() {
    return zh() ? CHINA : CHINA.concat(WORLD);
  }

  function cityName(id) {
    var opts = CHINA.concat(WORLD);
    for (var i = 0; i < opts.length; i++) if (opts[i][0] === id) return zh() ? opts[i][1] : opts[i][2];
    return id;
  }

  function t(key) {
    var Z = zh();
    var c = cityName(state.cityId);
    var map = {
      scoreTitle: Z ? "录入比分" : "Enter score",
      scoreLead: Z ? "记下球员名和盘分，保存在本机历史。" : "Save player names and set scores on this device.",
      playerA: Z ? "球员甲" : "Player A",
      playerB: Z ? "球员乙" : "Player B",
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
      cityLabel: Z ? "城市" : "City",
      cityIp: Z ? ("已按 IP 定位到 " + c + "，可随时切换。") : ("Using " + c + " from your IP. Change it anytime."),
      cityManual: Z ? ("当前显示 " + c + "（你已手动选择）。") : ("Showing " + c + " (you picked this city)."),
      cityDefault: Z ? ("当前显示 " + c + "。") : ("Showing " + c + "."),
      rankTitle: Z ? "本地排行" : "Local ladder",
      rankLead: Z ? (c + " 排行。按等级分，根据本地战绩更新。") : (c + " ladder. Ranked by a 等级分-like rating from local match results."),
      singles: Z ? "单打" : "Singles",
      doubles: Z ? "双打" : "Doubles",
      emptyRank: Z ? (c + " 暂无球员。") : ("No players in " + c + " yet."),
      howBody: Z
        ? "城市排行：起点是自评水平 × 2.15（等级分）。每场按「对这个对手该不该赢」调整。近六周权重大。双打步长更小。只含所选城市。"
        : "City ladder: seed = self-level × 2.15 (UTR-like). Match results move ratings. Last six weeks weigh more. Only players in the selected city.",
      seedOnly: Z ? "等级分 {n} · 还没有比赛" : "等级分 {n} · no matches yet",
      form: "{w}–{l}",
      count: Z ? ("{n} 位球员 · " + c) : ("{n} players · " + c),
    };
    return map[key] || key;
  }

  function loadScores() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function saveScores(rows) {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {}
  }
  function loadCity() {
    try {
      var v = localStorage.getItem(CITY_KEY);
      if (!v) return null;
      var opts = cityOptions();
      for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return v;
      return null;
    } catch (e) { return null; }
  }
  function saveCity(id) {
    try { localStorage.setItem(CITY_KEY, id); } catch (e) {}
    try {
      fetch("/tennis/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: id }),
      }).catch(function () {});
    } catch (e) {}
  }

  function round1(x) { return Math.round(x * 10) / 10; }
  function seed(n) { return round1(n * 2.15); }
  function sideMean(ids, ratings) {
    var s = 0, n = 0;
    for (var i = 0; i < ids.length; i++) {
      if (isFinite(ratings[ids[i]])) { s += ratings[ids[i]]; n++; }
    }
    return n ? s / n : 0;
  }
  function actualFromSets(sets) {
    if (!sets || !sets.length) return 1;
    var tw = 0, tl = 0;
    for (var i = 0; i < sets.length; i++) { tw += sets[i][0]; tl += sets[i][1]; }
    var share = tw / Math.max(1, tw + tl);
    return Math.min(0.92, Math.max(0.58, 0.58 + (share - 0.5) * 0.72));
  }
  function rateLadder(format, cityId) {
    var scoped = PLAYERS.filter(function (p) { return p.cityId === cityId; });
    var allowed = {};
    scoped.forEach(function (p) { allowed[p.id] = true; });
    var ratings = {}, wins = {}, losses = {}, last = {};
    scoped.forEach(function (p) { ratings[p.id] = seed(p.ntrp); });
    var K = format === "singles" ? 0.42 : 0.28;
    var now = Date.parse("2026-10-07T12:00:00");
    var ordered = MATCHES.filter(function (m) {
      if (m.format !== format) return false;
      var ids = m.winners.concat(m.losers);
      for (var i = 0; i < ids.length; i++) if (!allowed[ids[i]]) return false;
      return true;
    }).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    ordered.forEach(function (m) {
      var self = sideMean(m.winners, ratings);
      var opp = sideMean(m.losers, ratings);
      var actual = actualFromSets(m.sets);
      var expected = 1 / (1 + Math.pow(10, (opp - self) / 2.4));
      var ageDays = Math.max(0, (now - Date.parse(m.date + "T12:00:00")) / 864e5);
      var step = Math.exp(-ageDays / 42) * K;
      m.winners.forEach(function (id) {
        ratings[id] = (ratings[id] || 0) + step * (actual - expected);
        wins[id] = (wins[id] || 0) + 1;
        last[id] = { opp: m.losers[0], result: "win" };
      });
      m.losers.forEach(function (id) {
        ratings[id] = (ratings[id] || 0) + step * (1 - actual - (1 - expected));
        losses[id] = (losses[id] || 0) + 1;
        last[id] = { opp: m.winners[0], result: "loss" };
      });
    });
    var names = {};
    scoped.forEach(function (p) { names[p.id] = p.name; });
    var rows = scoped.map(function (p) {
      var played = (wins[p.id] || 0) + (losses[p.id] || 0);
      var L = last[p.id];
      return {
        id: p.id, name: p.name, rating: round1(ratings[p.id]), seed: seed(p.ntrp),
        wins: wins[p.id] || 0, losses: losses[p.id] || 0, played: played > 0,
        lastOpponentName: L ? names[L.opp] : "", lastResult: L ? L.result : ""
      };
    });
    rows.sort(function (a, b) { return b.rating - a.rating || a.name.localeCompare(b.name); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }

  function hideSearchAndBuddyCards() {
    var page = document.querySelector('[data-page="friends"]') || document.body;
    // hide search
    var nodes = page.querySelectorAll(".search, [class*=\"search\"]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.querySelector && (el.querySelector(".search-input") || el.querySelector("input"))) {
        el.style.display = "none";
        el.setAttribute(MARK + "-hide", "search");
      }
    }
    var inputs = page.querySelectorAll("input");
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j];
      if (inp.closest("[" + MARK + "]") || inp.closest("[" + SCORE_MARK + "]")) continue;
      var ph = (inp.getAttribute("placeholder") || inp.placeholder || "").trim();
      if (/搜索球友|搜索球场|Search friends|Search courts/i.test(ph)) {
        var wrap = inp.closest(".search") || inp.parentElement;
        if (wrap) { wrap.style.display = "none"; wrap.setAttribute(MARK + "-hide", "search"); }
      }
    }
    // hide hardcoded buddy cards ([data-friend] rows / .menu with friend-meta UTR · venue)
    var friends = page.querySelectorAll("[data-friend]");
    for (var k = 0; k < friends.length; k++) {
      var row = friends[k];
      var menu = row.closest(".menu") || row.parentElement;
      if (menu) { menu.style.display = "none"; menu.setAttribute(MARK + "-hide", "buddy"); }
      row.style.display = "none";
      row.setAttribute(MARK + "-hide", "buddy");
    }
    // hide legacy ladder + howBody (we replace with city ladder)
    var ladder = page.querySelector("[data-ladder]");
    if (ladder) {
      ladder.style.display = "none";
      ladder.setAttribute(MARK + "-hide", "ladder");
    }
    // hide count line that says 无锡一带 / Wuxi area
    var texts = page.querySelectorAll(".count-line, .body-copy");
    for (var tidx = 0; tidx < texts.length; tidx++) {
      var tx = texts[tidx].textContent || "";
      if (/无锡一带|Wuxi area|起点是自评水平|Seed = self-level/i.test(tx)) {
        // only hide the old howBody / count when not inside our inject
        if (!texts[tidx].closest("[" + MARK + "]")) {
          texts[tidx].style.display = "none";
          texts[tidx].setAttribute(MARK + "-hide", "blurb");
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
      "[" + MARK + "] input,[" + MARK + "] select{height:36px;border:1px solid #d1d5db;border-radius:10px;padding:0 10px;font-size:14px;background:#fff}" +
      "[" + MARK + "] .set-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}" +
      "[" + MARK + "] .set-row span{width:52px;font-size:11px;color:#6b7280}" +
      "[" + MARK + "] .set-row input{flex:1;text-align:center}" +
      "[" + MARK + "] .err{color:#b91c1c;font-size:12px;margin:6px 0}" +
      "[" + MARK + "] button.save{width:100%;height:36px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-weight:600;font-size:14px}" +
      "[" + MARK + "-city]{margin:12px 16px 4px;padding:14px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff}" +
      "[" + MARK + "-city] label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#6b7280}" +
      "[" + MARK + "-city] select{height:36px;border:1px solid #d1d5db;border-radius:10px;padding:0 10px;font-size:14px;background:#fff;width:100%}" +
      "[" + MARK + "-city] .hint{margin:8px 0 0;font-size:11px;color:#6b7280;line-height:1.5}" +
      "[" + MARK + "-rank]{margin:8px 16px 16px}" +
      "[" + MARK + "-rank] h3{margin:0;font-size:14px;font-weight:700}" +
      "[" + MARK + "-rank] .lead{margin:6px 0 10px;font-size:12px;color:#6b7280;line-height:1.5}" +
      "[" + MARK + "-rank] .filters{display:flex;gap:8px;margin-bottom:10px}" +
      "[" + MARK + "-rank] .chip{flex:1;border:0;border-radius:10px;padding:10px;font-size:13px;font-weight:600;background:#f3f4f6;color:#6b7280}" +
      "[" + MARK + "-rank] .chip.on{background:#0f766e;color:#fff}" +
      "[" + MARK + "-rank] .card{border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff;overflow:hidden}" +
      "[" + MARK + "-rank] .item{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.06);align-items:flex-start}" +
      "[" + MARK + "-rank] .item:last-child{border-bottom:0}" +
      "[" + MARK + "-rank] .rank{width:22px;font-weight:700;color:#0f766e;font-size:14px}" +
      "[" + MARK + "-rank] .initial{width:40px;height:40px;border-radius:999px;background:#ccfbf1;color:#0f766e;display:flex;align-items:center;justify-content:center;font-weight:700}" +
      "[" + MARK + "-rank] .name{font-size:14px;font-weight:600}" +
      "[" + MARK + "-rank] .meta{font-size:12px;color:#6b7280;margin-top:2px}" +
      "[" + MARK + "-rank] .rating{margin-left:auto;font-weight:700;font-size:14px}" +
      "[" + MARK + "-rank] .how{margin:10px 0 0;font-size:11px;color:#6b7280;line-height:1.5}" +
      "[" + MARK + "-rank] .empty{font-size:12px;color:#6b7280;padding:8px 0}" +
      "[" + MARK + "-hist]{margin:8px 16px 8px}" +
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

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function parsePair(a, b) {
    var ga = Number(a), gb = Number(b);
    if (!isFinite(ga) || !isFinite(gb)) return null;
    if (ga < 0 || gb < 0 || ga > 99 || gb > 99) return null;
    if (ga === 0 && gb === 0) return null;
    return [Math.floor(ga), Math.floor(gb)];
  }
  function winnerFromSets(sets) {
    var wa = 0, wb = 0;
    for (var i = 0; i < sets.length; i++) {
      if (sets[i][0] === sets[i][1]) continue;
      if (sets[i][0] > sets[i][1]) wa++; else wb++;
    }
    if (wa === wb) return null;
    return wa > wb ? "A" : "B";
  }
  function formatSets(sets) {
    return sets.map(function (s) { return s[0] + "-" + s[1]; }).join(" · ");
  }

  function renderHistory(host) {
    var rows = loadScores();
    host.innerHTML = "";
    var head = document.createElement("div");
    head.className = "head";
    head.innerHTML = "<h3>" + t("history") + "</h3>";
    if (rows.length) {
      var clearBtn = document.createElement("button");
      clearBtn.type = "button"; clearBtn.className = "clear"; clearBtn.textContent = t("clear");
      clearBtn.onclick = function () { saveScores([]); renderHistory(host); };
      head.appendChild(clearBtn);
    }
    host.appendChild(head);
    if (!rows.length) {
      var empty = document.createElement("p"); empty.className = "empty"; empty.textContent = t("empty");
      host.appendChild(empty); return;
    }
    var card = document.createElement("div"); card.className = "card";
    rows.forEach(function (row) {
      var item = document.createElement("div"); item.className = "item"; item.setAttribute("data-score-row", row.id);
      var winnerName = row.winner === "A" ? row.playerA : row.playerB;
      item.innerHTML = '<div class="name">' + escapeHtml(row.playerA) + " vs " + escapeHtml(row.playerB) + "</div>" +
        '<div class="meta">' + escapeHtml(formatSets(row.sets)) + "</div>" +
        '<div class="meta">' + escapeHtml(t("winner").replace("{name}", winnerName)) + " · " + escapeHtml((row.savedAt || "").slice(0, 10)) + "</div>";
      card.appendChild(item);
    });
    host.appendChild(card);
  }

  function renderRank(host) {
    var rows = rateLadder(state.format, state.cityId);
    host.innerHTML = "";
    host.setAttribute("data-ladder-city", state.cityId);
    var title = document.createElement("h3"); title.textContent = t("rankTitle"); host.appendChild(title);
    var lead = document.createElement("p"); lead.className = "lead"; lead.textContent = t("rankLead"); host.appendChild(lead);
    var filters = document.createElement("div"); filters.className = "filters"; filters.setAttribute("data-ladder-toggle", "true");
    ["singles", "doubles"].forEach(function (fmt) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "chip" + (state.format === fmt ? " on" : "");
      btn.setAttribute("data-ladder-format", fmt);
      btn.textContent = t(fmt);
      btn.onclick = function () { state.format = fmt; renderRank(host); };
      filters.appendChild(btn);
    });
    host.appendChild(filters);
    if (!rows.length) {
      var empty = document.createElement("p"); empty.className = "empty"; empty.textContent = t("emptyRank");
      host.appendChild(empty);
    } else {
      var card = document.createElement("div"); card.className = "card";
      rows.forEach(function (row) {
        var item = document.createElement("div"); item.className = "item";
        item.setAttribute("data-ladder-row", row.id); item.setAttribute("data-ladder-rank", String(row.rank));
        var form = row.played ? t("form").replace("{w}", row.wins).replace("{l}", row.losses) : t("seedOnly").replace("{n}", row.seed.toFixed(1));
        item.innerHTML = '<div class="rank">' + row.rank + '</div><div class="initial">' + escapeHtml(row.name.slice(0,1)) +
          '</div><div style="min-width:0;flex:1"><div style="display:flex;justify-content:space-between;gap:8px"><div class="name">' +
          escapeHtml(row.name) + '</div><div class="rating">' + row.rating.toFixed(1) + '</div></div><div class="meta">' +
          escapeHtml(form) + "</div></div>";
        card.appendChild(item);
      });
      host.appendChild(card);
    }
    var how = document.createElement("p"); how.className = "how"; how.textContent = t("howBody"); host.appendChild(how);
  }

  function renderCity(host) {
    host.innerHTML = "";
    var label = document.createElement("label");
    label.innerHTML = t("cityLabel");
    var sel = document.createElement("select");
    sel.setAttribute("data-city-select", "true");
    cityOptions().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c[0]; opt.textContent = zh() ? c[1] : c[2];
      if (c[0] === state.cityId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = function () {
      state.cityId = sel.value; state.source = "manual"; saveCity(state.cityId);
      var rank = document.querySelector("[" + MARK + "-rank]");
      var city = document.querySelector("[" + MARK + "-city]");
      if (rank) renderRank(rank);
      if (city) renderCity(city);
      updateCountLine();
    };
    label.appendChild(sel);
    host.appendChild(label);
    var hint = document.createElement("p"); hint.className = "hint";
    hint.setAttribute("data-city-source", state.source);
    hint.textContent = state.source === "manual" ? t("cityManual") : state.source === "ip" ? t("cityIp") : t("cityDefault");
    host.appendChild(hint);
  }

  function updateCountLine() {
    var page = document.querySelector('[data-page="friends"]');
    if (!page) return;
    var rows = rateLadder(state.format, state.cityId);
    var line = page.querySelector(".count-line");
    if (line) {
      line.style.display = "";
      line.textContent = t("count").replace("{n}", String(rows.length));
      line.removeAttribute(MARK + "-hide");
    }
  }

  function detectCity(cb) {
    var stored = loadCity();
    if (stored) { state.cityId = stored; state.source = "manual"; state.ready = true; cb(); return; }
    var i = 0;
    function tryNext() {
      if (i >= GEO_URLS.length) {
        state.cityId = "wuxi"; state.source = "default"; state.ready = true; cb(); return;
      }
      var url = GEO_URLS[i++];
      fetch(url, { credentials: "include" }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (data) {
          var id = data && data.cityId;
          var opts = cityOptions();
          var ok = false;
          for (var j = 0; j < opts.length; j++) if (opts[j][0] === id) ok = true;
          if (ok) { state.cityId = id; state.source = "ip"; }
          else { state.cityId = "wuxi"; state.source = "default"; }
          state.ready = true; cb();
        })
        .catch(tryNext);
    }
    tryNext();
  }

  function mount() {
    if (!isFriendsPage()) return;
    ensureStyle();
    hideSearchAndBuddyCards();
    // remove old score-only inject if present (avoid duplicates)
    var oldScore = document.querySelector("[" + SCORE_MARK + "]");
    var oldHist = document.querySelector("[" + SCORE_MARK + "-hist]");
    if (oldScore) oldScore.remove();
    if (oldHist) oldHist.remove();
    if (document.querySelector("[" + MARK + "]")) {
      hideSearchAndBuddyCards();
      return;
    }
    var page = document.querySelector('[data-page="friends"]') || document.querySelector("uni-page-body") || document.body;

    var cityBox = document.createElement("section");
    cityBox.setAttribute(MARK + "-city", "true");
    cityBox.setAttribute("data-city-scope", "true");

    var box = document.createElement("section");
    box.setAttribute(MARK, "true");
    box.setAttribute("data-score-entry", "true");
    box.innerHTML =
      "<h3>" + t("scoreTitle") + "</h3><p class=\"lead\">" + t("scoreLead") + "</p>" +
      '<div class="row"><label>' + t("playerA") + '<input data-score-player="a" placeholder="' + t("phA") + '"/></label>' +
      "<label>" + t("playerB") + '<input data-score-player="b" placeholder="' + t("phB") + '"/></label></div>' +
      '<div style="font-size:11px;color:#6b7280;margin:4px 0 6px">' + t("sets") + "</div>" +
      [1,2,3].map(function (n) {
        return '<div class="set-row" data-score-set="' + n + '"><span>' + t("setN").replace("{n}", String(n)) +
          '</span><input inputmode="numeric" data-a="' + n + '" placeholder="6"/><span>–</span><input inputmode="numeric" data-b="' + n + '" placeholder="4"/></div>';
      }).join("") +
      '<p class="err" data-score-error hidden></p>' +
      '<button type="button" class="save" data-score-save="true">' + t("save") + "</button>";

    var hist = document.createElement("section");
    hist.setAttribute(MARK + "-hist", "true");
    hist.setAttribute("data-score-history", "true");

    var rank = document.createElement("section");
    rank.setAttribute(MARK + "-rank", "true");
    rank.setAttribute("data-ladder", state.format);

    var anchor = page.querySelector("[data-ladder]") || page.querySelector(".menu") || null;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(cityBox, anchor);
      anchor.parentNode.insertBefore(box, anchor);
      anchor.parentNode.insertBefore(hist, anchor);
      anchor.parentNode.insertBefore(rank, anchor);
    } else {
      page.appendChild(cityBox); page.appendChild(box); page.appendChild(hist); page.appendChild(rank);
    }

    var err = box.querySelector("[data-score-error]");
    box.querySelector("[data-score-save]").onclick = function () {
      var aName = (box.querySelector('[data-score-player="a"]').value || "").trim();
      var bName = (box.querySelector('[data-score-player="b"]').value || "").trim();
      err.hidden = true;
      if (!aName || !bName) { err.textContent = t("needNames"); err.hidden = false; return; }
      if (aName === bName) { err.textContent = t("distinct"); err.hidden = false; return; }
      var sets = [];
      for (var n = 1; n <= 3; n++) {
        var av = box.querySelector('[data-a="' + n + '"]').value;
        var bv = box.querySelector('[data-b="' + n + '"]').value;
        if (!String(av).trim() && !String(bv).trim()) continue;
        var pair = parsePair(av, bv);
        if (!pair) { err.textContent = t("badSets"); err.hidden = false; return; }
        sets.push(pair);
      }
      if (!sets.length) { err.textContent = t("needSets"); err.hidden = false; return; }
      var winner = winnerFromSets(sets);
      if (!winner) { err.textContent = t("needWinner"); err.hidden = false; return; }
      var rows = loadScores();
      rows.unshift({ id: "s-" + Date.now(), savedAt: new Date().toISOString(), playerA: aName, playerB: bName, sets: sets, winner: winner });
      saveScores(rows.slice(0, 40));
      box.querySelector('[data-score-player="a"]').value = "";
      box.querySelector('[data-score-player="b"]').value = "";
      for (var i = 1; i <= 3; i++) { box.querySelector('[data-a="' + i + '"]').value = ""; box.querySelector('[data-b="' + i + '"]').value = ""; }
      renderHistory(hist);
    };

    detectCity(function () {
      renderCity(cityBox);
      renderHistory(hist);
      renderRank(rank);
      updateCountLine();
      hideSearchAndBuddyCards();
    });
  }

  function tick() {
    try { mount(); hideSearchAndBuddyCards(); } catch (e) {}
  }
  tick();
  setInterval(tick, 900);
  document.addEventListener("DOMContentLoaded", tick);
  window.addEventListener("hashchange", tick);
  window.addEventListener("popstate", tick);
})();

  try { loadDirectoryPlayers(function () { if (typeof render === "function") render(); }); } catch (e) {}
