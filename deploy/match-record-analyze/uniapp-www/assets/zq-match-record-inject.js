/*! 涨球 分析 tab：比赛录制 / 分析（SwingVision 向 MVP，本地演示数据） */
(function () {
  var MARK = "data-zq-match-record-inject";
  var STYLE_ID = "zq-match-record-style";
  var KEY = "zq-match-records-v1";

  function zh() {
    try {
      var loc = localStorage.getItem("tennis-locale") || "";
      if (loc === "en") return false;
      if (loc === "zh") return true;
    } catch (e) {}
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0;
  }

  function isAnalysisPage() {
    var href = location.href || "";
    return /pages\/analysis/i.test(href) || /#\/pages\/analysis/i.test(href) || /analysis\/index/i.test(href);
  }

  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildDemo(seed, format, mode) {
    var rand = mulberry32(seed || 1083);
    var points = [];
    var t = 0, gy = 0, go = 0, py = 0, po = 0, idx = 0;
    var heat = [];
    for (var i = 0; i < 8; i++) heat.push([0, 0, 0, 0]);
    while (idx < 16) {
      if (rand() < 0.18) {
        points.push({ id: "d" + idx, index: idx++, dead: true, rallyLength: 0, setScore: gy + "-" + go, scoreBefore: "30-30", scoreAfter: "30-30", result: "forced_error", shots: [] });
        t += 4;
        continue;
      }
      var rally = 1 + Math.floor(rand() * 7);
      var shots = [];
      for (var s = 0; s < rally; s++) {
        var x = 0.15 + rand() * 0.7, y = 0.2 + rand() * 0.6;
        heat[Math.min(7, Math.floor(x * 8))][Math.min(3, Math.floor(y * 4))] += 1;
        var path = [];
        for (var k = 0; k <= 6; k++) {
          var u = k / 6;
          path.push({ x: 0.5 + (x - 0.5) * u, y: 0.85 + (y - 0.85) * u });
        }
        shots.push({
          side: s % 2 ? "opp" : "you",
          stroke: s ? (rand() > 0.5 ? "forehand" : "backhand") : "serve",
          speedKmh: Math.round(65 + rand() * 75),
          ballPath: path,
        });
        t += 0.85;
      }
      var winner = rand() > 0.5 ? "you" : "opp";
      if (winner === "you") py++; else po++;
      if ((py >= 4 || po >= 4) && Math.abs(py - po) >= 2) {
        if (py > po) gy++; else go++;
        py = po = 0;
      }
      var results = ["winner", "unforced_error", "ace", "forced_error"];
      points.push({
        id: "p" + idx,
        index: idx++,
        setScore: gy + "-" + go,
        scoreBefore: "30-15",
        scoreAfter: "40-15",
        result: results[Math.floor(rand() * results.length)],
        rallyLength: rally,
        shots: shots,
        winner: winner,
        dead: false,
        lineCall: { call: rand() > 0.75 ? "out" : "in", confidence: 0.72 + rand() * 0.2 },
      });
      t += 1.1;
    }
    var live = points.filter(function (p) { return !p.dead; });
    var you = [];
    live.forEach(function (p) { p.shots.forEach(function (s) { if (s.side === "you") you.push(s); }); });
    function avg(xs) { return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : 0; }
    return {
      id: "m-" + Date.now().toString(36),
      title: zh() ? (mode === "ground" ? "Ground Mode 演示赛" : "涨球演示赛") : "Zhangqiu demo match",
      format: format || "singles",
      mode: mode || "standard",
      finalScore: gy + "-" + go,
      points: points,
      heatmap: heat,
      stats: {
        avgSpeedKmh: Math.round(avg(you.map(function (s) { return s.speedKmh; }))),
        avgRally: Math.round(avg(live.map(function (p) { return p.rallyLength; })) * 10) / 10,
        winners: live.filter(function (p) { return p.result === "winner" && p.winner === "you"; }).length,
        unforced: live.filter(function (p) { return p.result === "unforced_error"; }).length,
      },
      coaching: [
        { id: live[0].id, title: zh() ? "发球落点偏中路" : "Serve too central", body: zh() ? "一发多落中线，下一场打宽外角。" : "Widen first-serve targets." },
        { id: (live[2] || live[0]).id, title: zh() ? "反手非受迫偏多" : "Backhand UFE", body: zh() ? "快节奏时优先打深过渡。" : "Prefer deep safety under pace." },
      ],
      speedDisclaimer: zh() ? "球速为估测值，误差约 ±10%。" : "Speed estimate ±10%.",
      watchNote: zh() ? "Apple Watch 挑战喊判：coming（iOS 后续）。" : "Watch challenge callouts: coming.",
    };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".zq-mr-btn{display:block;margin:10px 12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(244,239,228,.25);background:#1f4a38;color:#f4efe4;font-size:14px;font-weight:700;text-align:center}",
      ".zq-mr-hint{margin:0 12px 8px;font-size:11px;color:#9bb0a4;line-height:1.45}",
      ".zq-mr-overlay{position:fixed;inset:0;z-index:99999;background:#07140e;color:#f4efe4;overflow:auto;font-family:ui-sans-serif,system-ui,sans-serif}",
      ".zq-mr-overlay .box{padding:16px 14px 40px;max-width:720px;margin:0 auto}",
      ".zq-mr-overlay h1{font-size:20px;margin:0}",
      ".zq-mr-overlay .muted{color:#9bb0a4;font-size:12px;line-height:1.5;margin-top:6px}",
      ".zq-mr-overlay .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
      ".zq-mr-overlay .chip,.zq-mr-overlay .act{border:1px solid rgba(244,239,228,.2);border-radius:10px;padding:8px 12px;background:transparent;color:#f4efe4;font-size:12px}",
      ".zq-mr-overlay .chip.on,.zq-mr-overlay .act.primary{background:#2f7a56;border-color:#7dd3a0}",
      ".zq-mr-overlay canvas{width:100%;border-radius:12px;background:#1f4a38;display:block;margin-top:12px}",
      ".zq-mr-overlay .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}",
      ".zq-mr-overlay .stat{border:1px solid rgba(244,239,228,.15);border-radius:10px;padding:10px;background:rgba(18,50,38,.7)}",
      ".zq-mr-overlay .stat b{display:block;margin-top:4px;font-size:15px}",
      ".zq-mr-overlay .list{max-height:160px;overflow:auto;border:1px solid rgba(244,239,228,.12);border-radius:10px;margin-top:8px}",
      ".zq-mr-overlay .item{padding:8px 10px;font-size:11px;border-bottom:1px solid rgba(244,239,228,.08)}",
      ".zq-mr-overlay .item.on{background:rgba(125,211,160,.14);color:#7dd3a0}",
      ".zq-mr-overlay .coach{margin-top:10px;padding:10px;border:1px solid rgba(244,239,228,.12);border-radius:10px}",
    ].join("");
    document.head.appendChild(s);
  }

  function saveMatch(m) {
    try {
      var rows = [];
      try { rows = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { rows = []; }
      if (!Array.isArray(rows)) rows = [];
      rows = [m].concat(rows.filter(function (x) { return x.id !== m.id; })).slice(0, 20);
      localStorage.setItem(KEY, JSON.stringify(rows));
    } catch (e) {}
  }

  function openPanel(opts) {
    opts = opts || {};
    var format = opts.format || "singles";
    var mode = opts.mode || "standard";
    var match = buildDemo(Date.now() % 100000, format, mode);
    saveMatch(match);
    var live = match.points.filter(function (p) { return !p.dead; });
    var active = live[0];
    var ballTrace = true;
    var voice = false;

    var overlay = document.createElement("div");
    overlay.className = "zq-mr-overlay";
    overlay.setAttribute(MARK, "panel");
    overlay.innerHTML = '<div class="box"></div>';
    document.body.appendChild(overlay);
    var box = overlay.querySelector(".box");

    function draw(canvas) {
      var ctx = canvas.getContext("2d");
      var w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#1f4a38";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(244,239,228,.85)";
      ctx.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.08); ctx.lineTo(w * 0.5, h * 0.92);
      ctx.moveTo(w * 0.08, h * 0.5); ctx.lineTo(w * 0.92, h * 0.5);
      ctx.stroke();
      match.heatmap.forEach(function (col, x) {
        col.forEach(function (v, y) {
          if (!v) return;
          ctx.fillStyle = "rgba(250,204,21," + Math.min(0.5, v * 0.1) + ")";
          ctx.fillRect(w * (0.08 + x / 8 * 0.84), h * (0.08 + y / 4 * 0.84), w * 0.1, h * 0.2);
        });
      });
      if (ballTrace && active) {
        active.shots.forEach(function (shot) {
          ctx.beginPath();
          shot.ballPath.forEach(function (p, i) {
            var px = w * (0.08 + p.x * 0.84), py = h * (0.08 + p.y * 0.84);
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          });
          ctx.strokeStyle = shot.side === "you" ? "#7dd3fc" : "#fda4af";
          ctx.stroke();
        });
      }
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, w, 28);
      ctx.fillStyle = "#f4efe4";
      ctx.font = "600 13px sans-serif";
      ctx.fillText((active ? active.setScore + " · " + active.scoreBefore : match.finalScore), 10, 18);
    }

    function render() {
      var Z = zh();
      box.innerHTML =
        '<button type="button" class="act" data-close="1">' + (Z ? "关闭" : "Close") + "</button>" +
        "<h1 style='margin-top:10px'>" + match.title + "</h1>" +
        '<p class="muted">' + (match.format === "doubles" ? (Z ? "双打" : "Doubles") : (Z ? "单打" : "Singles")) +
        " · " + match.finalScore + " · " + (mode === "ground" ? "Ground Mode" : (Z ? "标准" : "Standard")) + "</p>" +
        '<div class="row">' +
        '<button type="button" class="chip ' + (format === "singles" ? "on" : "") + '" data-format="singles">' + (Z ? "单打" : "Singles") + "</button>" +
        '<button type="button" class="chip ' + (format === "doubles" ? "on" : "") + '" data-format="doubles">' + (Z ? "双打" : "Doubles") + "</button>" +
        '<button type="button" class="chip ' + (mode === "standard" ? "on" : "") + '" data-mode="standard">' + (Z ? "标准" : "Standard") + "</button>" +
        '<button type="button" class="chip ' + (mode === "ground" ? "on" : "") + '" data-mode="ground">Ground</button>' +
        "</div>" +
        '<div class="row">' +
        '<button type="button" class="act primary" data-rebuild="1">' + (Z ? "重新生成演示赛" : "Rebuild demo") + "</button>" +
        '<button type="button" class="act" data-trace="1">' + (Z ? "球轨迹 " : "Ball trace ") + (ballTrace ? (Z ? "开" : "on") : (Z ? "关" : "off")) + "</button>" +
        '<button type="button" class="act" data-voice="1">' + (Z ? "语音喊判 " : "Voice ") + (voice ? (Z ? "开" : "on") : (Z ? "关" : "off")) + "</button>" +
        '<button type="button" class="act" data-share="1">' + (Z ? "复制分享提示" : "Copy share hint") + "</button>" +
        "</div>" +
        '<canvas id="zq-mr-canvas" width="' + (mode === "ground" ? 320 : 640) + '" height="' + (mode === "ground" ? 560 : 360) + '" data-ball-trace="' + (ballTrace ? "on" : "off") + '"></canvas>' +
        '<p class="muted" data-speed-disclaimer="true">' + match.speedDisclaimer + "</p>" +
        '<p class="muted" data-watch-note="true">' + match.watchNote + "</p>" +
        '<div class="grid">' +
        [["均速", match.stats.avgSpeedKmh + " km/h"], ["回合", match.stats.avgRally], ["制胜", match.stats.winners], ["非受迫", match.stats.unforced]].map(function (pair) {
          return '<div class="stat"><span class="muted">' + (Z && pair[0] === "均速" ? "均速" : pair[0]) + "</span><b>" + pair[1] + "</b></div>";
        }).join("") +
        "</div>" +
        '<p class="muted" style="margin-top:12px">' + (Z ? "高光分（已剪空镜）" : "Highlights (dead time trimmed)") + "</p>" +
        '<div class="list">' + live.map(function (p) {
          return '<div class="item ' + (active && p.id === active.id ? "on" : "") + '" data-point="' + p.id + '">#' + (p.index + 1) + " · " + p.setScore + " " + p.scoreBefore + " · " + p.result + " · " + p.rallyLength + (Z ? "拍" : " shots") + "</div>";
        }).join("") + "</div>" +
        '<p class="muted" style="margin-top:12px">' + (Z ? "涨球教练 · 赛后点评" : "Zhangqiu Coach") + "</p>" +
        match.coaching.map(function (c) {
          return '<div class="coach"><b>' + c.title + "</b><div class='muted'>" + c.body + '</div><button type="button" class="act" style="margin-top:8px" data-jump="' + c.id + '">' + (Z ? "跳到该分" : "Jump") + "</button></div>";
        }).join("") +
        '<p class="muted" style="margin-top:12px">' + (Z ? "访客分享走 https://yqchen.blog/tennis/share/m/…（无需会员）。教练复盘钩子对接消息。" : "Viewer share: https://yqchen.blog/tennis/share/m/… Coach review via inbox.") + "</p>" +
        '<p class="muted">涨球 / 涨球教练 · stroke analyze unchanged</p>';

      var canvas = box.querySelector("#zq-mr-canvas");
      draw(canvas);

      box.onclick = function (e) {
        var t = e.target;
        if (!t) return;
        if (t.getAttribute("data-close")) { overlay.remove(); return; }
        if (t.getAttribute("data-format")) { format = t.getAttribute("data-format"); match = buildDemo(Date.now() % 99999, format, mode); live = match.points.filter(function (p) { return !p.dead; }); active = live[0]; saveMatch(match); render(); return; }
        if (t.getAttribute("data-mode")) { mode = t.getAttribute("data-mode"); match = buildDemo(Date.now() % 99999, format, mode); live = match.points.filter(function (p) { return !p.dead; }); active = live[0]; saveMatch(match); render(); return; }
        if (t.getAttribute("data-rebuild")) { match = buildDemo(Date.now() % 99999, format, mode); live = match.points.filter(function (p) { return !p.dead; }); active = live[0]; saveMatch(match); render(); return; }
        if (t.getAttribute("data-trace")) { ballTrace = !ballTrace; render(); return; }
        if (t.getAttribute("data-voice")) {
          voice = !voice;
          if (voice && window.speechSynthesis && active) {
            var u = new SpeechSynthesisUtterance((active.setScore || "") + ". " + (active.lineCall && active.lineCall.call === "out" ? (Z ? "出界" : "Out") : (Z ? "界内" : "In")));
            u.lang = Z ? "zh-CN" : "en-US";
            window.speechSynthesis.speak(u);
          }
          render();
          return;
        }
        if (t.getAttribute("data-share")) {
          var tip = "https://yqchen.blog/tennis/match-record-analyze.html";
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tip);
          alert(Z ? "已复制预览分享页（正式分享链在登录 web 生成）" : "Copied preview share page");
          return;
        }
        if (t.getAttribute("data-point")) {
          var id = t.getAttribute("data-point");
          active = live.find(function (p) { return p.id === id; }) || active;
          if (voice && window.speechSynthesis && active) {
            var u2 = new SpeechSynthesisUtterance(active.setScore + " " + active.result);
            u2.lang = Z ? "zh-CN" : "en-US";
            window.speechSynthesis.speak(u2);
          }
          render();
          return;
        }
        if (t.getAttribute("data-jump")) {
          var jid = t.getAttribute("data-jump");
          active = live.find(function (p) { return p.id === jid; }) || active;
          render();
        }
      };
    }
    render();
  }

  function mountEntry() {
    if (!isAnalysisPage()) return;
    ensureStyle();
    if (document.querySelector("[" + MARK + "='entry']")) return;
    var host = document.querySelector("#app") || document.body;
    var wrap = document.createElement("div");
    wrap.setAttribute(MARK, "entry");
    wrap.innerHTML =
      '<button type="button" class="zq-mr-btn" data-zq-open-match="1">' + (zh() ? "比赛录制 / 分析" : "Match record / analyze") + "</button>" +
      '<p class="zq-mr-hint">' + (zh()
        ? "SwingVision 向：剪空镜、计分条、球速热力、赛后点评。挥拍技术分析不变。球速 ±10%。"
        : "SwingVision-inspired match analyze. Stroke analyze unchanged. Speed ±10%.") + "</p>";
    // Prefer inserting near top of analysis content
    if (host.firstChild) host.insertBefore(wrap, host.firstChild);
    else host.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-zq-open-match")) openPanel({ format: "singles", mode: "standard" });
    });
  }

  function tick() {
    try { mountEntry(); } catch (e) {}
  }

  tick();
  setInterval(tick, 1200);
  window.addEventListener("hashchange", tick);
  window.addEventListener("popstate", tick);
})();
