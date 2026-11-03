/*! 涨球 我的/Profile：当前位置城市可改；写入 auth profile + zq-friends-city-v1 */
(function () {
  if (window.__ZQ_PROFILE_CITY_INJECT__) return;
  window.__ZQ_PROFILE_CITY_INJECT__ = true;

  var CITY_KEY = "zq-friends-city-v1";
  var MARK = "data-zq-profile-city";
  var GEO_URLS = [
    "https://yqchen.blog/tennis/api/geo/city",
    "/tennis/api/geo/city",
  ];
  var CHINA = [
    ["beijing", "北京", "Beijing"],
    ["shanghai", "上海", "Shanghai"],
    ["guangzhou", "广州", "Guangzhou"],
    ["shenzhen", "深圳", "Shenzhen"],
    ["hangzhou", "杭州", "Hangzhou"],
    ["nanjing", "南京", "Nanjing"],
    ["suzhou", "苏州", "Suzhou"],
    ["wuxi", "无锡", "Wuxi"],
    ["chengdu", "成都", "Chengdu"],
    ["chongqing", "重庆", "Chongqing"],
    ["wuhan", "武汉", "Wuhan"],
    ["xian", "西安", "Xi'an"],
    ["tianjin", "天津", "Tianjin"],
    ["qingdao", "青岛", "Qingdao"],
    ["xiamen", "厦门", "Xiamen"],
    ["changsha", "长沙", "Changsha"],
    ["zhengzhou", "郑州", "Zhengzhou"],
    ["hefei", "合肥", "Hefei"],
    ["ningbo", "宁波", "Ningbo"],
    ["dongguan", "东莞", "Dongguan"],
    ["hongkong", "香港", "Hong Kong"],
    ["taipei", "台北", "Taipei"],
  ];
  var WORLD = [
    ["newyork", "纽约", "New York"],
    ["losangeles", "洛杉矶", "Los Angeles"],
    ["london", "伦敦", "London"],
    ["paris", "巴黎", "Paris"],
    ["tokyo", "东京", "Tokyo"],
    ["seoul", "首尔", "Seoul"],
    ["singapore", "新加坡", "Singapore"],
    ["sydney", "悉尼", "Sydney"],
    ["toronto", "多伦多", "Toronto"],
    ["dubai", "迪拜", "Dubai"],
    ["bangkok", "曼谷", "Bangkok"],
    ["berlin", "柏林", "Berlin"],
  ];

  function zh() {
    try {
      var lang = (localStorage.getItem("tennis-ai-locale") || document.documentElement.lang || navigator.language || "zh").toLowerCase();
      return !lang.startsWith("en");
    } catch (e) {
      return true;
    }
  }
  function cityOptions() {
    return zh() ? CHINA.slice() : CHINA.concat(WORLD);
  }
  function cityName(id) {
    var opts = cityOptions();
    for (var i = 0; i < opts.length; i++) if (opts[i][0] === id) return zh() ? opts[i][1] : opts[i][2];
    return id;
  }
  function isProfilePage() {
    var path = (location.pathname || "") + (location.hash || "");
    if (/profile|\/me\b|我的/i.test(path)) return true;
    if (document.querySelector('[data-page="profile"], #profile-card, [data-profile-display-name]')) return true;
    var title = (document.querySelector(".header-title, .brand-name, h1") || {}).textContent || "";
    if (/我的|Profile|Mine/i.test(title) && document.querySelector(".hero, #profile-card, .logout")) return true;
    // uni-app tab: last tab often 我的
    var tabs = document.querySelectorAll(".tab-label, .tab .tab-label");
    for (var i = 0; i < tabs.length; i++) {
      if (/我的|Profile/i.test(tabs[i].textContent || "") && tabs[i].closest(".tab") && /active/.test(tabs[i].closest(".tab").className || "")) {
        return true;
      }
    }
    return false;
  }
  function loadCity() {
    try {
      var v = localStorage.getItem(CITY_KEY);
      if (!v) return null;
      var opts = cityOptions();
      for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return v;
      return null;
    } catch (e) {
      return null;
    }
  }
  function saveCityLocal(id) {
    try { localStorage.setItem(CITY_KEY, id); } catch (e) {}
  }
  function patchProfile(cityId, cb) {
    fetch("/tennis/api/auth/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId: cityId }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) { if (cb) cb(x.ok, x.d); })
      .catch(function () { if (cb) cb(false, null); });
  }
  function ensureStyle() {
    if (document.getElementById("zq-profile-city-style")) return;
    var s = document.createElement("style");
    s.id = "zq-profile-city-style";
    s.textContent = [
      "[" + MARK + "]{margin-top:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);}",
      "[" + MARK + "] label{display:block;font-size:11px;opacity:.92;margin-bottom:6px;color:#fff;}",
      "[" + MARK + "] select{width:100%;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(15,23,42,.25);color:#fff;padding:0 10px;font-size:14px;}",
      "[" + MARK + "] .hint{margin-top:6px;font-size:11px;opacity:.88;color:#fff;line-height:1.4;}",
      "[" + MARK + "].on-card{background:#f8fafc;border:1px solid #e2e8f0;}",
      "[" + MARK + "].on-card label,[" + MARK + "].on-card .hint{color:#0f172a;opacity:1;}",
      "[" + MARK + "].on-card select{background:#fff;color:#0f172a;border-color:#e2e8f0;}",
    ].join("");
    document.head.appendChild(s);
  }
  function detectCity(cb) {
    var stored = loadCity();
    if (stored) { cb(stored, "manual"); return; }
    var i = 0;
    function tryNext() {
      if (i >= GEO_URLS.length) { cb("wuxi", "default"); return; }
      var url = GEO_URLS[i++];
      fetch(url, { credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (data) {
          var id = data && data.cityId;
          var opts = cityOptions();
          var ok = false;
          for (var j = 0; j < opts.length; j++) if (opts[j][0] === id) ok = true;
          cb(ok ? id : "wuxi", ok ? "ip" : "default");
        })
        .catch(tryNext);
    }
    tryNext();
  }
  function mountBox(host, cityId) {
    if (!host || host.querySelector("[" + MARK + "]")) return;
    ensureStyle();
    var box = document.createElement("div");
    box.setAttribute(MARK, "true");
    box.setAttribute("data-profile-city-editor", "true");
    if (!host.classList.contains("hero") && host.id !== "profile-card") box.className = "on-card";
    var label = document.createElement("label");
    label.setAttribute("for", "zq-profile-city-select");
    label.textContent = zh() ? "当前位置 / 城市（球友排行与匹配用）" : "Current location / city (friends ladder & matchmaking)";
    var sel = document.createElement("select");
    sel.id = "zq-profile-city-select";
    sel.setAttribute("data-profile-city-select", "true");
    cityOptions().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c[0];
      opt.textContent = zh() ? c[1] : c[2];
      if (c[0] === cityId) opt.selected = true;
      sel.appendChild(opt);
    });
    var hint = document.createElement("p");
    hint.className = "hint";
    hint.setAttribute("data-profile-city-note", "true");
    hint.textContent = zh()
      ? ("当前：" + cityName(cityId))
      : ("Now: " + cityName(cityId));
    sel.onchange = function () {
      var next = sel.value;
      saveCityLocal(next);
      hint.textContent = zh() ? "保存中…" : "Saving…";
      patchProfile(next, function (ok) {
        hint.textContent = ok
          ? (zh() ? ("当前位置已设为" + cityName(next)) : ("Location set to " + cityName(next)))
          : (zh() ? "城市保存失败（已记在本机）" : "Save failed (kept locally)");
      });
    };
    box.appendChild(label);
    box.appendChild(sel);
    box.appendChild(hint);
    host.appendChild(box);
  }
  function findHost() {
    return (
      document.querySelector("#profile-card") ||
      document.querySelector(".hero") ||
      document.querySelector('[data-page="profile"] .content') ||
      document.querySelector(".content .stack") ||
      document.querySelector(".content")
    );
  }
  function tryMount() {
    if (!isProfilePage()) return;
    var host = findHost();
    if (!host) return;
    if (host.querySelector("[" + MARK + "]") || document.querySelector("[data-profile-city-editor='true'] select")) return;
    detectCity(function (id) {
      saveCityLocal(id);
      mountBox(host, id);
    });
  }

  var obs = new MutationObserver(function () { tryMount(); });
  function start() {
    tryMount();
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tryMount, 1800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
