/*! 涨球 分析 tab：比赛录制 / 分析（全绿球场、底线轨迹、全部回合、locale-only；含摄像头架设） */
(function () {
  var MARK = "data-zq-match-record-inject";
  var STYLE_ID = "zq-match-record-style";
  var KEY = "zq-match-records-v1";
  var TRACE_YOU = "#38bdf8";
  var TRACE_OPP = "#f87171";

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

  function sideLabel(side, players) {
    players = players || {};
    if (side === "you") {
      var yn = String(players.you || "").trim();
      if (yn && yn !== "你" && yn !== "我" && yn.toLowerCase() !== "you") {
        return zh() ? yn + "（你）" : yn + " (you)";
      }
      return zh() ? "你（己方）" : "You";
    }
    var on = String(players.opp || "").trim();
    if (on && on !== "对手" && on.toLowerCase() !== "opponent") {
      return zh() ? on + "（对手）" : on + " (opp)";
    }
    return zh() ? "对手" : "Opponent";
  }

  function tennisScore(a, b) {
    var labels = ["0", "15", "30", "40"];
    if (a >= 3 && b >= 3) {
      if (a === b) return "40-40";
      if (a === b + 1) return "Ad-40";
      if (b === a + 1) return "40-Ad";
    }
    return labels[Math.min(a, 3)] + "-" + labels[Math.min(b, 3)];
  }

  function buildDemo(seed, format, mode) {
    var rand = mulberry32(seed || 1083);
    var points = [];
    var t = 0, gy = 0, go = 0, py = 0, po = 0, idx = 0;
    var heat = [];
    for (var i = 0; i < 8; i++) heat.push([0, 0, 0, 0]);
    // Full set to 6 games (with 7 if needed) — list every live rally, not a short sample.
    while (gy < 6 || go < 6) {
      if ((gy >= 6 || go >= 6) && Math.abs(gy - go) >= 2) break;
      if (gy === 7 || go === 7 || idx > 400) break;
      if (rand() < 0.12) {
        points.push({ id: "d" + idx, index: idx++, dead: true, rallyLength: 0, setScore: gy + "-" + go, scoreBefore: tennisScore(py, po), scoreAfter: tennisScore(py, po), result: "forced_error", shots: [], winner: "you" });
        t += 4;
        continue;
      }
      var server = (gy + go) % 2 === 0 ? "you" : "opp";
      var rally = 1 + Math.floor(rand() * 8);
      var shots = [];
      var scoreBefore = tennisScore(py, po);
      for (var s = 0; s < rally; s++) {
        var side = s % 2 === 0 ? server : (server === "you" ? "opp" : "you");
        var endX = 0.15 + rand() * 0.7;
        // Straight line 网后→对面网后 (no sine/bezier); realistic lateral contact.
        var y0 = side === "you" ? 0.95 : 0.05;
        var y1 = side === "you" ? 0.05 : 0.95;
        var x0 = 0.18 + rand() * 0.64;
        var path = [];
        for (var k = 0; k <= 10; k++) {
          var u = k / 10;
          path.push({ x: x0 + (endX - x0) * u, y: y0 + (y1 - y0) * u });
        }
        var end = path[path.length - 1];
        heat[Math.min(7, Math.floor(end.x * 8))][Math.min(3, Math.floor(end.y * 4))] += 1;
        shots.push({
          id: "s-" + idx + "-" + s,
          side: side,
          stroke: s ? (rand() > 0.5 ? "forehand" : "backhand") : "serve",
          shotIndex: s + 1,
          speedKmh: Math.round(65 + rand() * 75),
          x: end.x,
          y: end.y,
          ballPath: path,
        });
        t += 0.85;
      }
      var results = ["winner", "unforced_error", "ace", "forced_error", "double_fault"];
      var result = results[Math.floor(rand() * results.length)];
      var winner = rand() > 0.5 ? "you" : "opp";
      if (result === "ace") winner = server;
      if (result === "double_fault") winner = server === "you" ? "opp" : "you";
      if (winner === "you") py++; else po++;
      var gameOver = (py >= 4 || po >= 4) && Math.abs(py - po) >= 2;
      if (gameOver) {
        if (py > po) gy++; else go++;
        py = po = 0;
      }
      points.push({
        id: "p" + idx,
        index: idx++,
        setScore: gy + "-" + go,
        scoreBefore: scoreBefore,
        scoreAfter: gameOver ? "0-0" : tennisScore(py, po),
        result: result,
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
    var players = format === "doubles"
      ? { you: "你", opp: "对手 A", youPartner: "搭档", oppPartner: "对手 B" }
      : { you: "你", opp: "对手" };
    return {
      id: "m-" + Date.now().toString(36),
      title: zh() ? (mode === "ground" ? "地面机位演示赛" : "涨球演示赛") : (mode === "ground" ? "Ground-mode demo" : "Zhangqiu demo match"),
      format: format || "singles",
      mode: mode || "standard",
      finalScore: gy + "-" + go,
      players: players,
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
      watchNote: "",
    };
  }

  function cameraCopy() {
    var Z = zh();
    return {
      title: Z ? "录制前：摄像头架设" : "Before recording: camera setup",
      subtitle: Z ? "摆好机位再开始，球速、落点与线审更稳。" : "Frame the court first for steadier speed, depth, and line calls.",
      duringTitle: Z ? "录制中请保持" : "While recording",
      during: Z ? "手机固定、勿遮挡；尽量飞行模式避免来电打断。整场都要看到双侧底线。" : "Keep the phone locked; avoid blocking the lens. Prefer airplane mode. Keep both baselines in view the whole session.",
      standardTitle: Z ? "标准机位（围网或三脚架）" : "Standard (fence or tripod)",
      groundTitle: Z ? "地面机位（手机放地上）" : "Ground mode (phone on the ground)",
      ready: Z ? "确认机位，开始录制" : "Framing looks good — start",
      groundChip: Z ? "地面机位" : "Ground mode",
      standardChip: Z ? "标准机位" : "Standard",
      items: Z ? [
        { key: "height", label: "高度", text: "尽量架高（围网顶端最佳），但别让球网挡住远端底线。" },
        { key: "distance", label: "距离", text: "放在底线后方、靠近场地中线；单打可略偏弱侧约一脚，减少挡球。" },
        { key: "angle", label: "角度", text: "整片场地入镜：两侧底线及线后约 1–2 米；略俯拍，近端发球线落在画面偏下。" },
        { key: "net", label: "球网与底线", text: "球网顶边尽量不要压住远端发球线或底线；画面居中对齐场地。" },
        { key: "light", label: "光线与挡风网", text: "太阳在手机背后一侧；尽量对着没有挡风网的一侧。" }
      ] : [
        { key: "height", label: "Height", text: "Mount as high as practical (fence-top preferred) without the net covering the far baseline." },
        { key: "distance", label: "Distance", text: "Behind the baseline near center; for singles, offset about one foot toward the weaker side so players block less." },
        { key: "angle", label: "Angle", text: "Fit the whole court: both baselines plus a few feet behind each; tilt down so the near service line sits in the lower third." },
        { key: "net", label: "Net and baseline", text: "Avoid the net tape overlapping the far service or baseline; keep the court centered." },
        { key: "light", label: "Light and windscreen", text: "Sun behind the phone; prefer the side without a windscreen." }
      ],
      groundItems: Z ? [
        { key: "prop", label: "支撑", text: "在底线后中场附近放水瓶（或稳定物），手机斜靠其上。" },
        { key: "aim", label: "取景", text: "俯仰到球网白边落在取景提示框内；能看到双侧底线与线后空间。" },
        { key: "stable", label: "稳定", text: "确认不会被风吹倒；开录前再看一眼是否整场可见。" }
      ] : [
        { key: "prop", label: "Prop", text: "Place a water bottle (or stable object) on the ground near mid-court behind the baseline; lean the phone against it." },
        { key: "aim", label: "Framing", text: "Tilt until the net tape sits in the guide box; keep both baselines and a bit of space behind them visible." },
        { key: "stable", label: "Stable", text: "Make sure wind will not tip it; double-check the full court before you start." }
      ]
    };
  }

  function cameraSetupHtml(mode) {
    var c = cameraCopy();
    var list = mode === "ground" ? c.groundItems : c.items;
    return (
      '<section data-section="camera-setup" data-mode="' + mode + '">' +
      "<h2 style='font-size:15px;margin:12px 0 4px'>" + c.title + "</h2>" +
      '<p class="muted">' + c.subtitle + "</p>" +
      "<h3 style='font-size:12px;margin:10px 0 6px'>" + (mode === "ground" ? c.groundTitle : c.standardTitle) + "</h3>" +
      '<ul class="zq-cam-list">' + list.map(function (it) {
        return '<li data-tip="' + it.key + '"><b>' + it.label + "</b><span>" + it.text + "</span></li>";
      }).join("") + "</ul>" +
      '<p class="zq-cam-during" data-during-tip="1"><b>' + c.duringTitle + "</b> " + c.during + "</p>" +
      "</section>"
    );
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
      ".zq-mr-overlay .list{max-height:min(52vh,420px);overflow:auto;border:1px solid rgba(244,239,228,.12);border-radius:10px;margin-top:8px}",
      ".zq-mr-overlay .list[data-section='all-rallies']{max-height:min(60vh,520px)}",
      ".zq-mr-overlay .item{padding:8px 10px;font-size:11px;border-bottom:1px solid rgba(244,239,228,.08);display:flex;justify-content:space-between;gap:8px}",
      ".zq-mr-overlay .item.on{background:rgba(125,211,160,.14);color:#7dd3a0}",
      ".zq-mr-overlay .legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-size:12px;font-weight:700}",
      ".zq-mr-overlay .legend .you{color:" + TRACE_YOU + "}",
      ".zq-mr-overlay .legend .opp{color:" + TRACE_OPP + "}",
      ".zq-mr-overlay .coach{margin-top:10px;padding:10px;border:1px solid rgba(244,239,228,.12);border-radius:10px}",
      ".zq-cam-list{list-style:none;padding:0;margin:8px 0;display:grid;gap:8px}",".zq-cam-list li{border:1px solid rgba(244,239,228,.12);border-radius:10px;padding:10px;background:rgba(18,50,38,.55)}",".zq-cam-list b{display:block;font-size:12px;margin-bottom:4px}",".zq-cam-list span{font-size:11px;color:#b7c7bd;line-height:1.45}",".zq-cam-during{margin-top:10px;font-size:11px;color:#b7c7bd;line-height:1.45;padding:10px;border:1px dashed rgba(244,239,228,.18);border-radius:10px}",
      ".zq-mr-overlay .shot-speed{font-weight:700}",
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
      var Z = zh();
      ctx.clearRect(0, 0, w, h);
      var x0 = w * 0.08, x1 = w * 0.92, xm = w * 0.5;
      var y0 = h * 0.14, y1 = h * 0.82, ym = (y0 + y1) / 2;
      function mapX(px) { return x0 + px * (x1 - x0); }
      function mapY(py) { return y0 + py * (y1 - y0); }
      ctx.fillStyle = "#1f4a38";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(244,239,228,.85)";
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.beginPath();
      ctx.moveTo(xm, y0); ctx.lineTo(xm, y1);
      ctx.moveTo(x0, ym); ctx.lineTo(x1, ym);
      ctx.moveTo(x0, mapY(0.25)); ctx.lineTo(x1, mapY(0.25));
      ctx.moveTo(x0, mapY(0.75)); ctx.lineTo(x1, mapY(0.75));
      ctx.moveTo(xm, mapY(0.25)); ctx.lineTo(xm, mapY(0.75));
      ctx.stroke();
      // no heatmap / yellow tiles — solid green court only
      if (ballTrace && active) {
        active.shots.forEach(function (shot, i) {
          var color = shot.side === "you" ? TRACE_YOU : TRACE_OPP;
          var n = shot.shotIndex || i + 1;
          ctx.beginPath();
          shot.ballPath.forEach(function (p, pi) {
            var px = mapX(p.x), py = mapY(p.y);
            if (pi) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          });
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          var last = shot.ballPath[shot.ballPath.length - 1] || { x: shot.x, y: shot.y };
          var lx = mapX(last.x);
          var ly = mapY(last.y);
          ctx.beginPath();
          ctx.arc(lx, ly, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          var rallyTxt = Z ? ("第 " + n + " 拍") : ("Shot " + n);
          var speedTxt = Z ? (shot.speedKmh + " 公里/时") : (shot.speedKmh + " km/h");
          ctx.font = "600 11px sans-serif";
          var tw = Math.max(ctx.measureText(rallyTxt).width, ctx.measureText(speedTxt).width);
          var bx = Math.min(Math.max(4, lx + 8), w - tw - 12);
          var by = Math.min(Math.max(32, ly - 34), h - 40);
          ctx.fillStyle = "rgba(7,20,14,.78)";
          ctx.fillRect(bx, by, tw + 8, 28);
          ctx.fillStyle = color;
          ctx.fillText(rallyTxt, bx + 4, by + 12);
          ctx.fillStyle = "#f4efe4";
          ctx.fillText(speedTxt, bx + 4, by + 24);
        });
      }
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, w, 28);
      ctx.fillStyle = "#f4efe4";
      ctx.font = "600 13px sans-serif";
      ctx.fillText((active ? active.setScore + " · " + active.scoreBefore : match.finalScore), 10, 18);
      // canvas legend
      ctx.fillStyle = "rgba(7,20,14,.72)";
      ctx.fillRect(8, h - 34, w - 16, 26);
      ctx.font = "600 11px sans-serif";
      ctx.fillStyle = TRACE_YOU;
      ctx.fillText((Z ? "蓝 = " : "Blue = ") + sideLabel("you", match.players), 16, h - 16);
      ctx.fillStyle = TRACE_OPP;
      ctx.fillText((Z ? "红 = " : "Red = ") + sideLabel("opp", match.players), Math.min(w * 0.48, w - 120), h - 16);
    }

    function render() {
      var Z = zh();
      var youL = sideLabel("you", match.players);
      var oppL = sideLabel("opp", match.players);
      box.innerHTML =
        '<button type="button" class="act" data-close="1">' + (Z ? "关闭" : "Close") + "</button>" +
        "<h1 style='margin-top:10px'>" + match.title + "</h1>" +
        '<p class="muted">' + (match.format === "doubles" ? (Z ? "双打" : "Doubles") : (Z ? "单打" : "Singles")) +
        " · " + match.finalScore + " · " + (mode === "ground" ? (Z ? "地面机位" : "Ground mode") : (Z ? "标准" : "Standard")) + "</p>" +
        '<div class="row">' +
        '<button type="button" class="chip ' + (format === "singles" ? "on" : "") + '" data-format="singles">' + (Z ? "单打" : "Singles") + "</button>" +
        '<button type="button" class="chip ' + (format === "doubles" ? "on" : "") + '" data-format="doubles">' + (Z ? "双打" : "Doubles") + "</button>" +
        '<button type="button" class="chip ' + (mode === "standard" ? "on" : "") + '" data-mode="standard">' + (Z ? "标准机位" : "Standard") + "</button>" +
        '<button type="button" class="chip ' + (mode === "ground" ? "on" : "") + '" data-mode="ground">' + (Z ? "地面机位" : "Ground mode") + "</button>" +
        "</div>" +
        cameraSetupHtml(mode) +
        '<div class="row">' +
        '<button type="button" class="act primary" data-rebuild="1">' + (Z ? "重新生成演示赛" : "Rebuild demo") + "</button>" +
        '<button type="button" class="act" data-trace="1">' + (Z ? "球轨迹 " : "Ball trace ") + (ballTrace ? (Z ? "开" : "on") : (Z ? "关" : "off")) + "</button>" +
        '<button type="button" class="act" data-voice="1">' + (Z ? "语音喊判 " : "Voice ") + (voice ? (Z ? "开" : "on") : (Z ? "关" : "off")) + "</button>" +
        '<button type="button" class="act" data-share="1">' + (Z ? "复制分享提示" : "Copy share hint") + "</button>" +
        "</div>" +
        '<canvas id="zq-mr-canvas" width="' + (mode === "ground" ? 320 : 640) + '" height="' + (mode === "ground" ? 560 : 360) + '" data-ball-trace="' + (ballTrace ? "on" : "off") + '"></canvas>' +
        '<div class="legend" data-trace-legend="you-opp"><span class="you">' + (Z ? "蓝 = " : "Blue = ") + youL + '</span><span class="opp">' + (Z ? "红 = " : "Red = ") + oppL + "</span></div>" +
        '<p class="muted" data-speed-disclaimer="true">' + (Z ? match.speedDisclaimer : "Speed estimate ±10%.") + "</p>" +
        '<div class="grid">' +
        [
          [Z ? "均速" : "Avg", Z ? (match.stats.avgSpeedKmh + " 公里/时") : (match.stats.avgSpeedKmh + " km/h")],
          [Z ? "回合" : "Rally", match.stats.avgRally],
          [Z ? "制胜" : "Winners", match.stats.winners],
          [Z ? "非受迫" : "UFEs", match.stats.unforced],
        ].map(function (pair) {
          return '<div class="stat"><span class="muted">' + pair[0] + "</span><b>" + pair[1] + "</b></div>";
        }).join("") +
        "</div>" +
        '<p class="muted" style="margin-top:12px">' + (Z ? "本分每球球速 / 第几拍" : "Per-shot speed / rally index") + "</p>" +
        '<div class="list" data-section="per-shot-speeds">' + ((active && active.shots) || []).map(function (shot, i) {
          var n = shot.shotIndex || i + 1;
          var color = shot.side === "you" ? TRACE_YOU : TRACE_OPP;
          var spd = Z ? (shot.speedKmh + " 公里/时") : (shot.speedKmh + " km/h");
          return '<div class="item" data-shot-index="' + n + '" data-shot-side="' + shot.side + '" data-shot-speed="' + shot.speedKmh + '"><span>' +
            (Z ? ("第 " + n + " 拍") : ("Shot " + n)) + " · " + sideLabel(shot.side, match.players) +
            '</span><span class="shot-speed" style="color:' + color + '">' + spd + "</span></div>";
        }).join("") + "</div>" +
        '<p class="muted" style="margin-top:12px">' + (Z ? ("全部回合 " + live.length + " 分（已剪空镜）") : ("All rallies · " + live.length + " points (dead time trimmed)")) + "</p>" +
        '<div class="list" data-section="all-rallies">' + live.map(function (p, pi) {
          var resMap = { winner: Z ? "制胜分" : "winner", unforced_error: Z ? "非受迫" : "unforced", ace: Z ? "发球直接得分" : "ace", forced_error: Z ? "压迫失误" : "forced", double_fault: Z ? "双误" : "double fault" };
          var res = resMap[p.result] || p.result;
          return '<div class="item ' + (active && p.id === active.id ? "on" : "") + '" data-point="' + p.id + '">#' + (pi + 1) + " · " + p.setScore + " " + p.scoreBefore + " · " + res + " · " + p.rallyLength + (Z ? "拍" : " shots") + "</div>";
        }).join("") + "</div>" +
        '<p class="muted" style="margin-top:12px">' + (Z ? "涨球教练 · 赛后点评" : "Zhangqiu Coach") + "</p>" +
        match.coaching.map(function (c) {
          return '<div class="coach"><b>' + (Z ? c.title : (c.titleEn || c.title)) + "</b><div class='muted'>" + (Z ? c.body : (c.bodyEn || c.body)) + '</div><button type="button" class="act" style="margin-top:8px" data-jump="' + c.id + '">' + (Z ? "跳到该分" : "Jump") + "</button></div>";
        }).join("") +
        '<p class="muted" style="margin-top:12px">' + (Z ? "访客分享走 https://yqchen.blog/tennis/share/m/…（无需会员）。教练复盘钩子对接消息。" : "Viewer share: https://yqchen.blog/tennis/share/m/… Coach review via inbox.") + "</p>" +
        '<p class="muted">' + (Z ? "涨球 / 涨球教练 · 挥拍技术分析入口不变" : "Zhangqiu / Zhangqiu Coach · stroke analyze unchanged") + "</p>";

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
        ? "涨球比赛录制：先架摄像头，再开录。全绿球场、底线轨迹、全部回合、每球球速。蓝=你，红=对手。挥拍技术分析不变。"
        : "Zhangqiu match analyze: set camera first. All-green court, baseline traces, every rally, per-shot speed. Blue = you, red = opponent. Stroke analyze unchanged.") + "</p>";
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
