/*! 涨球 球友：王者荣耀式附近匹配（水平/城市/UTR）+ 保留城市排行与录入比分；无搜索球友/球场 */
(function () {
  var MARK = "data-zq-friends-matchmaking-inject";
  var STYLE_ID = "zq-friends-matchmaking-style";
  var CITY_KEY = "zq-friends-city-v1";
  var LEVEL_KEY = "zq-friends-self-level-v1";
  var NAME_KEY = "zq-friends-self-name-v1";
  var LEVELS = [2, 2.5, 3, 3.5, 4, 4.5, 5];

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
  var NEARBY = {
    wuxi:["suzhou","shanghai","nanjing","hangzhou"], suzhou:["wuxi","shanghai","hangzhou","nanjing"],
    shanghai:["suzhou","wuxi","hangzhou","ningbo"], hangzhou:["shanghai","ningbo","suzhou","nanjing"],
    nanjing:["wuxi","suzhou","hefei","hangzhou"], beijing:["tianjin"], tianjin:["beijing"],
    guangzhou:["shenzhen","dongguan"], shenzhen:["guangzhou","dongguan","hongkong"],
    dongguan:["guangzhou","shenzhen"], hongkong:["shenzhen","guangzhou"],
    chengdu:["chongqing"], chongqing:["chengdu"], wuhan:["changsha","hefei"], changsha:["wuhan"],
    xian:["zhengzhou"], zhengzhou:["xian","hefei"], hefei:["nanjing","wuhan","zhengzhou"],
    ningbo:["hangzhou","shanghai"], qingdao:["beijing","tianjin"], xiamen:["guangzhou","shenzhen"],
    taipei:["xiamen","hongkong"], newyork:["toronto"], toronto:["newyork"],
    london:["paris","berlin"], paris:["london","berlin"], berlin:["london","paris"],
    tokyo:["seoul"], seoul:["tokyo"], singapore:["bangkok"], bangkok:["singapore"],
    sydney:["singapore"], dubai:["bangkok"], losangeles:["newyork"]
  };
  var PLAYERS = [];
  var MATCHES = [];


  function ensureSelfInPlayers(list, cityId) {
    list = Array.isArray(list) ? list.slice() : [];
    var name = "";
    try {
      name = (localStorage.getItem("zq-friends-self-name-v1") || localStorage.getItem("tennis-ai-display-name") || "").trim();
    } catch (e) {}
    if (!name) {
      try { name = (state && state.name || "").trim(); } catch (e2) {}
    }
    cityId = String(cityId || (state && state.cityId) || "").trim();
    if (!name || !cityId) return list;
    var level = 3.5;
    try {
      var lv = Number(localStorage.getItem("zq-friends-self-level-v1"));
      if ([2, 2.5, 3, 3.5, 4, 4.5, 5].indexOf(lv) >= 0) level = lv;
    } catch (e3) {}
    try { if (state && typeof state.level === "number") level = state.level; } catch (e4) {}
    var id = "";
    try { id = (localStorage.getItem("tennis-ai-phone") || "").trim(); } catch (e5) {}
    if (!id) id = "self:" + name;
    list = list.filter(function (p) { return p && p.id !== id && p.name !== name; });
    list.push({ id: id, name: name, ntrp: level, cityId: cityId });
    return list;
  }



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
            if (data && data.self && data.self.phone) {
              localStorage.setItem("tennis-ai-phone", data.self.phone);
            }
          } catch (e) {}
          PLAYERS = ensureSelfInPlayers(PLAYERS, (state && state.cityId) || "");
          if (done) done(PLAYERS);
        }).catch(function () { next(); });
    }
    next();
  }

  var state = {
    phase: "idle",
    level: 3.5,
    name: "",
    cityId: "wuxi",
    buddy: null,
    recent: [],
    hint: 0,
    searchTimer: null,
    hintTimer: null
  };

  function isFriendsPage() {
    var href = location.href || "";
    return /pages\/friends\/index/i.test(href) || /#\/pages\/friends/i.test(href) ||
      !!document.querySelector('[data-page="friends"]');
  }
  function zh() {
    try {
      var loc = localStorage.getItem("tennis-locale") || "";
      if (loc === "en") return false;
      if (loc === "zh") return true;
    } catch (e) {}
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0;
  }
  function cityName(id) {
    var opts = CHINA.concat(WORLD);
    for (var i = 0; i < opts.length; i++) if (opts[i][0] === id) return zh() ? opts[i][1] : opts[i][2];
    return id;
  }
  function round1(x) { return Math.round(x * 10) / 10; }
  function seed(n) { return round1(n * 2.15); }
  function t(key, vars) {
    vars = vars || {};
    var Z = zh();
    var map = {
      title: Z ? "匹配约球" : "Find a match",
      lead: Z ? "按你的水平、城市和类 UTR，匹配一位合适的附近球友。像开一把排位。" : "Match a nearby buddy by level, city, and UTR-like rating — like queueing a ranked game.",
      selfName: Z ? "怎么称呼你" : "Your name",
      selfNamePh: Z ? "可选" : "Optional",
      selfLevel: Z ? "自评水平" : "Your level",
      you: Z ? "我" : "You",
      selfMeta: Z ? ("{city} · 水平 {level} · UTR {utr}") : ("{city} · level {level} · UTR {utr}"),
      start: Z ? "开始匹配" : "Start matching",
      idleHint: Z ? "优先同城、UTR 接近的球友；找不到再放宽到邻近城市。" : "Prefers same city and close UTR; widens to nearby cities if needed.",
      searching: Z ? "正在匹配附近球友…" : "Matching a nearby buddy…",
      hint1: Z ? "扫描同城球友…" : "Scanning same-city players…",
      hint2: Z ? "比对 UTR 接近度…" : "Comparing UTR proximity…",
      hint3: Z ? "核对自评水平…" : "Checking self-level…",
      hint4: Z ? "锁定合适对手…" : "Locking a fair match…",
      cancel: Z ? "取消" : "Cancel",
      found: Z ? "匹配成功" : "Match found",
      buddyMeta: Z ? ("{city} · 水平 {level} · 本地第 {rank}") : ("{city} · level {level} · local #{rank}"),
      reasonSameCityClose: Z ? ("同城，UTR 相差 {utrDelta}，势均力敌") : ("Same city, UTR Δ {utrDelta} — evenly matched"),
      reasonSameCityOk: Z ? ("同城球友，UTR 相差 {utrDelta}") : ("Same-city buddy, UTR Δ {utrDelta}"),
      reasonNearbyClose: Z ? ("邻近城市 {city}，UTR 很接近（Δ {utrDelta}）") : ("Nearby {city}, very close UTR (Δ {utrDelta})"),
      reasonNearbyOk: Z ? ("邻近 {city}，综合最合适（UTR Δ {utrDelta}）") : ("Nearby {city}, best overall fit (UTR Δ {utrDelta})"),
      again: Z ? "再匹配一次" : "Match again",
      invite: Z ? "录入对阵" : "Enter score",
      empty: Z ? ("{city} 附近暂时没有可匹配球友") : ("No matchable buddies near {city}")
    };
    var s = map[key] || key;
    Object.keys(vars).forEach(function (k) {
      s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
    });
    return s;
  }

  function loadLevel() {
    try {
      var n = Number(localStorage.getItem(LEVEL_KEY));
      if (LEVELS.indexOf(n) >= 0) return n;
    } catch (e) {}
    return 3.5;
  }
  function saveLevel(n) { try { localStorage.setItem(LEVEL_KEY, String(n)); } catch (e) {} }
  function loadName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  function loadCity() {
    try {
      var v = localStorage.getItem(CITY_KEY);
      if (!v) return "wuxi";
      var opts = CHINA.concat(WORLD);
      for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return v;
    } catch (e) {}
    return "wuxi";
  }

  function sideMean(ids, ratings) {
    var s = 0, n = 0;
    for (var i = 0; i < ids.length; i++) if (isFinite(ratings[ids[i]])) { s += ratings[ids[i]]; n++; }
    return n ? s / n : 0;
  }
  function actualFromSets(sets) {
    if (!sets || !sets.length) return 1;
    var tw = 0, tl = 0;
    for (var i = 0; i < sets.length; i++) { tw += sets[i][0]; tl += sets[i][1]; }
    var share = tw / Math.max(1, tw + tl);
    return Math.min(0.92, Math.max(0.58, 0.58 + (share - 0.5) * 0.72));
  }
  function rateCity(cityId) {
    var pool = ensureSelfInPlayers(PLAYERS, cityId);
    var scoped = pool.filter(function (p) { return p.cityId === cityId; });
    var allowed = {}; scoped.forEach(function (p) { allowed[p.id] = true; });
    var ratings = {}, wins = {}, losses = {};
    scoped.forEach(function (p) { ratings[p.id] = seed(p.ntrp); });
    var K = 0.42;
    var now = Date.parse("2026-10-07T12:00:00");
    MATCHES.filter(function (m) {
      if (m.format !== "singles") return false;
      var ids = m.winners.concat(m.losers);
      for (var i = 0; i < ids.length; i++) if (!allowed[ids[i]]) return false;
      return true;
    }).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .forEach(function (m) {
        var self = sideMean(m.winners, ratings);
        var opp = sideMean(m.losers, ratings);
        var actual = actualFromSets(m.sets);
        var expected = 1 / (1 + Math.pow(10, (opp - self) / 2.4));
        var ageDays = Math.max(0, (now - Date.parse(m.date + "T12:00:00")) / 864e5);
        var step = Math.exp(-ageDays / 42) * K;
        m.winners.forEach(function (id) {
          ratings[id] = (ratings[id] || 0) + step * (actual - expected);
          wins[id] = (wins[id] || 0) + 1;
        });
        m.losers.forEach(function (id) {
          ratings[id] = (ratings[id] || 0) + step * (1 - actual - (1 - expected));
          losses[id] = (losses[id] || 0) + 1;
        });
      });
    var rows = scoped.map(function (p) {
      return {
        id: p.id, name: p.name, ntrp: p.ntrp, cityId: p.cityId,
        rating: round1(ratings[p.id]), wins: wins[p.id] || 0, losses: losses[p.id] || 0,
        played: ((wins[p.id] || 0) + (losses[p.id] || 0)) > 0
      };
    });
    rows.sort(function (a, b) { return b.rating - a.rating || a.name.localeCompare(b.name); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }

  function cityDist(a, b) {
    if (a === b) return 0;
    var near = NEARBY[a] || [];
    var idx = near.indexOf(b);
    return idx >= 0 ? 1 + idx * 0.15 : 3.5;
  }
  function reasonKey(sameCity, utrDelta) {
    if (sameCity && utrDelta <= 0.5) return "sameCityClose";
    if (sameCity) return "sameCityOk";
    if (utrDelta <= 0.5) return "nearbyClose";
    return "nearbyOk";
  }
  function pickBuddy() {
    var selfUtr = seed(state.level);
    var cityId = loadCity();
    state.cityId = cityId;
    var pool = rateCity(cityId).slice();
    var near = NEARBY[cityId] || [];
    for (var i = 0; i < Math.min(3, near.length); i++) pool = pool.concat(rateCity(near[i]));
    var seen = {}, list = [];
    var selfName = (state.name || "").trim();
    var selfPhone = "";
    try { selfPhone = (localStorage.getItem("tennis-ai-phone") || "").trim(); } catch (e) {}
    for (var j = 0; j < pool.length; j++) {
      var row = pool[j];
      if (seen[row.id] || state.recent.indexOf(row.id) >= 0) continue;
      if (selfPhone && row.id === selfPhone) continue;
      if (selfName && row.name === selfName) continue;
      if (row.id && String(row.id).indexOf("self:") === 0) continue;
      seen[row.id] = true;
      var utrDelta = Math.abs(row.rating - selfUtr);
      var levelDelta = Math.abs(row.ntrp - state.level);
      var sameCity = row.cityId === cityId;
      var score = cityDist(cityId, row.cityId) * 2.2 + utrDelta * 1.8 + levelDelta * 0.9 + (row.played ? 0 : 0.25) + ((Math.random() * 17 + row.rank * 3) % 7) * 0.04;
      list.push({
        id: row.id, name: row.name, cityId: row.cityId, ntrp: row.ntrp, rating: row.rating,
        rank: row.rank, wins: row.wins, losses: row.losses, score: score,
        utrDelta: round1(utrDelta), levelDelta: round1(levelDelta), sameCity: sameCity,
        reason: reasonKey(sameCity, utrDelta)
      });
    }
    list.sort(function (a, b) { return a.score - b.score || a.utrDelta - b.utrDelta; });
    return list[0] || null;
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
      "[" + MARK + "] .stats{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:#f3f4f6;margin-bottom:10px}" +
      "[" + MARK + "] .stats .name{font-size:14px;font-weight:700}" +
      "[" + MARK + "] .stats .meta{font-size:11px;color:#6b7280;margin-top:2px}" +
      "[" + MARK + "] .stats .utr{font-size:18px;font-weight:800;color:#0f766e}" +
      "[" + MARK + "] .start{width:100%;height:48px;border:0;border-radius:14px;background:#0f766e;color:#fff;font-weight:800;font-size:16px}" +
      "[" + MARK + "] .idle-hint{margin:8px 0 0;font-size:11px;color:#6b7280;line-height:1.5}" +
      "[" + MARK + "] .searching{text-align:center;padding:8px 0}" +
      "[" + MARK + "] .pulse-wrap{position:relative;width:64px;height:64px;margin:0 auto 10px}" +
      "[" + MARK + "] .pulse{position:absolute;inset:8px;border-radius:999px;background:rgba(15,118,110,.2);animation:zqmm 1.2s ease-out infinite}" +
      "[" + MARK + "] .core{position:absolute;inset:16px;border-radius:999px;background:#0f766e}" +
      "@keyframes zqmm{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.35);opacity:0}}" +
      "[" + MARK + "] .search-title{font-size:14px;font-weight:700;margin:0 0 4px}" +
      "[" + MARK + "] .search-hint{font-size:12px;color:#6b7280;margin:0 0 12px}" +
      "[" + MARK + "] .cancel,[" + MARK + "] .again{height:40px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-weight:600;font-size:14px;width:100%}" +
      "[" + MARK + "] .found-title{text-align:center;color:#0f766e;font-weight:700;font-size:14px;margin:0 0 10px}" +
      "[" + MARK + "] .buddy{display:flex;gap:12px;padding:12px;border-radius:12px;border:1px solid rgba(15,118,110,.25);background:rgba(15,118,110,.06);margin-bottom:10px}" +
      "[" + MARK + "] .avatar{width:48px;height:48px;border-radius:999px;background:#0f766e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0}" +
      "[" + MARK + "] .buddy .nm{font-size:16px;font-weight:800}" +
      "[" + MARK + "] .buddy .rt{font-size:16px;font-weight:800;margin-left:auto}" +
      "[" + MARK + "] .buddy .meta{font-size:12px;color:#6b7280;margin-top:4px}" +
      "[" + MARK + "] .buddy .reason{font-size:11px;color:#0f766e;margin-top:4px;line-height:1.45}" +
      "[" + MARK + "] .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      "[" + MARK + "] .invite{height:40px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-weight:700;font-size:14px}" +
      "[" + MARK + "] .empty{font-size:12px;color:#6b7280;margin:0 0 8px}";
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function reasonText(buddy) {
    var city = cityName(buddy.cityId);
    var d = buddy.utrDelta.toFixed(1);
    if (buddy.reason === "sameCityClose") return t("reasonSameCityClose", { utrDelta: d });
    if (buddy.reason === "sameCityOk") return t("reasonSameCityOk", { utrDelta: d });
    if (buddy.reason === "nearbyClose") return t("reasonNearbyClose", { city: city, utrDelta: d });
    return t("reasonNearbyOk", { city: city, utrDelta: d });
  }

  function clearTimers() {
    if (state.searchTimer) { clearTimeout(state.searchTimer); state.searchTimer = null; }
    if (state.hintTimer) { clearInterval(state.hintTimer); state.hintTimer = null; }
  }

  function fillScoreNames(buddyName) {
    var a = document.querySelector('[data-score-player="a"]');
    var b = document.querySelector('[data-score-player="b"]');
    if (a && !(a.value || "").trim()) a.value = (state.name || "").trim() || t("you");
    if (b) b.value = buddyName;
  }

  function render(host) {
    var selfUtr = seed(state.level);
    var cname = cityName(loadCity());
    var displayName = (state.name || "").trim() || t("you");
    var html = "<h3>" + escapeHtml(t("title")) + "</h3><p class=\"lead\">" + escapeHtml(t("lead")) + "</p>";
    html += '<div class="row"><label>' + escapeHtml(t("selfName")) +
      '<input data-match-self-name value="' + escapeHtml(state.name) + '" placeholder="' + escapeHtml(t("selfNamePh")) + '"/></label>';
    html += "<label>" + escapeHtml(t("selfLevel")) + '<select data-match-self-level>';
    LEVELS.forEach(function (lv) {
      html += '<option value="' + lv + '"' + (lv === state.level ? " selected" : "") + ">" + lv.toFixed(1) + "</option>";
    });
    html += "</select></label></div>";
    html += '<div class="stats" data-match-self-stats="true"><div><div class="name">' + escapeHtml(displayName) +
      '</div><div class="meta">' + escapeHtml(t("selfMeta", { city: cname, level: state.level.toFixed(1), utr: selfUtr.toFixed(1) })) +
      '</div></div><div class="utr" data-match-self-utr="' + selfUtr + '">' + selfUtr.toFixed(1) + "</div></div>";

    if (state.phase === "idle" || state.phase === "empty") {
      if (state.phase === "empty") html += '<p class="empty" data-match-empty="true">' + escapeHtml(t("empty", { city: cname })) + "</p>";
      html += '<button type="button" class="start" data-match-start="true">' + escapeHtml(t("start")) + "</button>";
      html += '<p class="idle-hint">' + escapeHtml(t("idleHint")) + "</p>";
    } else if (state.phase === "searching") {
      var hints = [t("hint1"), t("hint2"), t("hint3"), t("hint4")];
      html += '<div class="searching" data-match-searching="true"><div class="pulse-wrap"><div class="pulse"></div><div class="core"></div></div>';
      html += '<p class="search-title">' + escapeHtml(t("searching")) + "</p>";
      html += '<p class="search-hint" data-match-hint="' + state.hint + '">' + escapeHtml(hints[state.hint % 4]) + "</p>";
      html += '<button type="button" class="cancel" data-match-cancel="true">' + escapeHtml(t("cancel")) + "</button></div>";
    } else if (state.phase === "found" && state.buddy) {
      var buddy = state.buddy;
      html += '<div data-match-found="true" data-match-buddy="' + escapeHtml(buddy.id) + '">';
      html += '<p class="found-title">' + escapeHtml(t("found")) + "</p>";
      html += '<div class="buddy"><div class="avatar">' + escapeHtml(buddy.name.slice(0, 1)) + '</div><div style="min-width:0;flex:1">';
      html += '<div style="display:flex;align-items:baseline;gap:8px"><div class="nm" data-match-buddy-name="true">' + escapeHtml(buddy.name) +
        '</div><div class="rt" data-match-buddy-utr="' + buddy.rating + '">' + buddy.rating.toFixed(1) + "</div></div>";
      html += '<div class="meta" data-match-buddy-meta="true">' + escapeHtml(t("buddyMeta", {
        city: cityName(buddy.cityId), level: buddy.ntrp.toFixed(1), rank: buddy.rank
      })) + "</div>";
      html += '<div class="reason" data-match-reason="' + buddy.reason + '">' + escapeHtml(reasonText(buddy)) + "</div></div></div>";
      html += '<div class="actions"><button type="button" class="again" data-match-again="true">' + escapeHtml(t("again")) +
        '</button><button type="button" class="invite" data-match-invite="true">' + escapeHtml(t("invite")) + "</button></div></div>";
    }
    host.innerHTML = html;

    var nameInput = host.querySelector("[data-match-self-name]");
    if (nameInput) nameInput.oninput = function () {
      state.name = nameInput.value; saveName(nameInput.value.trim());
    };
    var levelSel = host.querySelector("[data-match-self-level]");
    if (levelSel) levelSel.onchange = function () {
      state.level = Number(levelSel.value); saveLevel(state.level); render(host);
    };
    var startBtn = host.querySelector("[data-match-start]");
    if (startBtn) startBtn.onclick = function () { beginSearch(host); };
    var againBtn = host.querySelector("[data-match-again]");
    if (againBtn) againBtn.onclick = function () { beginSearch(host); };
    var cancelBtn = host.querySelector("[data-match-cancel]");
    if (cancelBtn) cancelBtn.onclick = function () {
      clearTimers(); state.phase = "idle"; state.buddy = null; render(host);
    };
    var inviteBtn = host.querySelector("[data-match-invite]");
    if (inviteBtn && state.buddy) inviteBtn.onclick = function () { fillScoreNames(state.buddy.name); };
  }

  function beginSearch(host) {
    clearTimers();
    state.phase = "searching";
    state.buddy = null;
    state.hint = 0;
    render(host);
    state.hintTimer = setInterval(function () {
      state.hint = (state.hint + 1) % 4;
      var el = host.querySelector("[data-match-hint]");
      if (el) {
        var hints = [t("hint1"), t("hint2"), t("hint3"), t("hint4")];
        el.setAttribute("data-match-hint", String(state.hint));
        el.textContent = hints[state.hint];
      }
    }, 700);
    state.searchTimer = setTimeout(function () {
      clearTimers();
      var buddy = pickBuddy();
      if (!buddy) {
        state.phase = "empty";
        state.buddy = null;
      } else {
        state.buddy = buddy;
        state.recent = [buddy.id].concat(state.recent.filter(function (id) { return id !== buddy.id; })).slice(0, 6);
        state.phase = "found";
      }
      render(host);
    }, 1600 + Math.floor(Math.random() * 1200));
  }

  function hideSearch() {
    var page = document.querySelector('[data-page="friends"]') || document.body;
    var inputs = page.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (inp.closest("[" + MARK + "]") || inp.closest("[data-zq-friends-city-inject]") || inp.closest("[data-score-entry]")) continue;
      var ph = (inp.getAttribute("placeholder") || "").trim();
      if (/搜索球友|搜索球场|Search friends|Search courts/i.test(ph)) {
        var wrap = inp.closest(".search") || inp.parentElement;
        if (wrap) wrap.style.display = "none";
      }
    }
  }

  function mount() {
    if (!isFriendsPage()) return;
    ensureStyle();
    hideSearch();
    if (document.querySelector("[" + MARK + "]")) {
      hideSearch();
      return;
    }
    state.level = loadLevel();
    state.name = loadName();
    state.cityId = loadCity();
    var page = document.querySelector('[data-page="friends"]') || document.querySelector("uni-page-body") || document.body;
    var box = document.createElement("section");
    box.setAttribute(MARK, "true");
    box.setAttribute("data-matchmaking", "true");
    var anchor =
      document.querySelector("[data-zq-friends-city-inject-city]") ||
      document.querySelector("[data-city-scope]") ||
      document.querySelector("[data-zq-friends-city-inject]") ||
      document.querySelector("[data-score-entry]") ||
      page.firstChild;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor);
    else page.insertBefore(box, page.firstChild);
    render(box);
  }

  function tick() {
    try { mount(); hideSearch(); } catch (e) {}
  }
  tick();
  setInterval(tick, 900);
  document.addEventListener("DOMContentLoaded", tick);
  window.addEventListener("hashchange", tick);
  window.addEventListener("popstate", tick);
})();

  try { loadDirectoryPlayers(function () { if (typeof render === "function") render(); }); } catch (e) {}
