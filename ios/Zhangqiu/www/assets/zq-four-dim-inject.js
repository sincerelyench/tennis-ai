/*! 涨球 report four-dim + speed inject for uni-app www (APK/IPA) */
(function () {
  var MARK = "data-zq-four-dim-inject";
  var AXIS = [
    { key: "重心", max: 25, label: "重心" },
    { key: "击球点", max: 20, label: "击球点" },
    { key: "动力链", max: 30, label: "动力链" },
    { key: "击球效果", max: 25, label: "击球效果" },
  ];

  function asKmh(v) {
    if (typeof v !== "number" || !isFinite(v) || v < 0 || v > 250) return null;
    return v < 20 ? Math.round(v * 10) / 10 : Math.round(v);
  }
  function fmtKmh(v) {
    if (v == null) return "—";
    return v >= 20 ? String(Math.round(v)) : Number(v).toFixed(1);
  }
  function pickSpeeds(report) {
    var sources = [];
    var overall = (report && report.overall) || {};
    if (overall.speeds) sources.push(overall.speeds);
    if (report && report.speeds) sources.push(report.speeds);
    var clips = (report && report.clips) || [];
    for (var i = 0; i < clips.length; i++) {
      var c = clips[i];
      if (c && c.summary && c.summary.speeds) sources.push(c.summary.speeds);
    }
    for (var s = 0; s < sources.length; s++) {
      var raw = sources[s] || {};
      var out = {
        racket_kmh: asKmh(raw.swing_kmh != null ? raw.swing_kmh : raw.racket_kmh),
        wrist_kmh: asKmh(raw.wrist_kmh),
        hip_kmh: asKmh(raw.hip_kmh),
        ball_in_kmh: asKmh(raw.ball_in_kmh),
        ball_out_kmh: asKmh(raw.ball_out_kmh),
        racket_kmh_max: asKmh(raw.swing_kmh_max != null ? raw.swing_kmh_max : raw.racket_kmh_max),
        swing_from: raw.swing_from === "wrist" || raw.swing_from === "racket" ? raw.swing_from : null,
      };
      if (
        out.racket_kmh != null ||
        out.wrist_kmh != null ||
        out.hip_kmh != null ||
        out.ball_in_kmh != null ||
        out.ball_out_kmh != null
      ) {
        return out;
      }
    }
    return null;
  }
  function axesFrom(report) {
    var scores = (report && report.scores) || (report && report.overall && report.overall.scores) || {};
    var rows = [];
    for (var i = 0; i < AXIS.length; i++) {
      var def = AXIS[i];
      var raw = Number(scores[def.key]);
      if (!isFinite(raw)) return [];
      rows.push({ key: def.key, label: def.label, value: Math.round(raw), max: def.max, pct: Math.max(0, Math.min(100, (raw / def.max) * 100)) });
    }
    return rows;
  }
  function readReports() {
    try {
      var raw = localStorage.getItem("tennis-reports-v2");
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  function currentReportId() {
    var href = location.href || "";
    var m = href.match(/[?&#/](?:reportId|id)=([^&#]+)/i) || href.match(/\/pages\/report\/[^?]+\?[^#]*id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    m = href.match(/report(?:s)?\/([a-zA-Z0-9_-]{6,64})/);
    if (m) return m[1];
    try {
      var hash = location.hash || "";
      var hm = hash.match(/[?&]id=([^&]+)/);
      if (hm) return decodeURIComponent(hm[1]);
    } catch (e) {}
    return null;
  }
  function ensureStyle() {
    if (document.getElementById("zq-fd-inject-style")) return;
    var s = document.createElement("style");
    s.id = "zq-fd-inject-style";
    s.textContent =
      ".zq-fd-inj{--ink:#0f1f16;--muted:#5b6b62;--border:#d5e0d9;--card:#fff;--soft:#f4faf7;--pri:#0d9488;color:var(--ink);margin:12px 12px 16px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC',sans-serif}" +
      ".zq-fd-inj h2{margin:0 0 8px;font-size:16px;font-weight:700}" +
      ".zq-fd-inj .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}" +
      ".zq-fd-inj .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:10px 12px}" +
      ".zq-fd-inj .lab{display:block;font-size:12px;color:var(--muted)}" +
      ".zq-fd-inj .val{margin:4px 0 6px;font-size:22px;font-weight:750;letter-spacing:-.02em}" +
      ".zq-fd-inj .max{font-size:12px;color:var(--muted);font-weight:500}" +
      ".zq-fd-inj .bar{height:7px;border-radius:99px;background:var(--soft);overflow:hidden}" +
      ".zq-fd-inj .bar>i{display:block;height:100%;background:linear-gradient(90deg,#14b8a6,var(--pri))}" +
      ".zq-fd-inj .note{margin:8px 0 0;font-size:12px;color:var(--muted);line-height:1.45}" +
      ".zq-fd-inj .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}";
    document.head.appendChild(s);
  }
  function render(host, report) {
    var axes = axesFrom(report);
    var speeds = pickSpeeds(report);
    if (!axes.length && !speeds) {
      host.setAttribute(MARK, "empty");
      host.innerHTML = '<section class="zq-fd-inj" data-zq-four-dim="empty"><p class="note">这次没有可用的画面速度估计。</p></section>';
      return;
    }
    var html = '<section class="zq-fd-inj" data-zq-four-dim="1">';
    if (axes.length) {
      html += "<h2>四维评分</h2><div class=\"grid\">";
      for (var i = 0; i < axes.length; i++) {
        var a = axes[i];
        html +=
          '<div class="card"><span class="lab">' +
          a.label +
          '</span><div class="val">' +
          a.value +
          ' <span class="max">/ ' +
          a.max +
          '</span></div><div class="bar"><i style="width:' +
          a.pct +
          '%"></i></div></div>';
      }
      html += "</div>";
    }
    html += "<h2>速度估计</h2>";
    if (!speeds) {
      html += '<p class="note">这次没有可用的画面速度估计。</p>';
    } else {
      var racketLab = speeds.swing_from === "wrist" ? "拍头·腕推算" : "拍头";
      var cells = [
        [racketLab, speeds.racket_kmh],
        ["手腕", speeds.wrist_kmh],
        ["转髋", speeds.hip_kmh],
        ["来球", speeds.ball_in_kmh],
        ["出球", speeds.ball_out_kmh],
      ];
      html += '<div class="sgrid">';
      for (var j = 0; j < cells.length; j++) {
        html +=
          '<div class="card"><span class="lab">' +
          cells[j][0] +
          '</span><div class="val">' +
          fmtKmh(cells[j][1]) +
          ' <span class="max">km/h</span></div></div>';
      }
      html += "</div>";
      var maxNote = fmtKmh(speeds.racket_kmh_max);
      html +=
        '<p class="note">按身高或拍长把画面位移换成公里每小时，不是测速雷达。侧面更准，正面会偏慢。' +
        (maxNote !== "—" ? "最快一拍拍头约 " + maxNote + " km/h。" : "") +
        "</p>";
    }
    html += "</section>";
    host.setAttribute(MARK, "1");
    host.innerHTML = html;
  }
  function mount() {
    var path = (location.hash || "") + (location.pathname || "") + (location.href || "");
    if (!/report/i.test(path)) {
      var old = document.querySelector("[" + MARK + "]");
      if (old && old.parentNode) old.parentNode.removeChild(old);
      return;
    }
    ensureStyle();
    var id = currentReportId();
    var reports = readReports();
    var report = null;
    if (id) {
      for (var i = 0; i < reports.length; i++) {
        if (String(reports[i].id) === String(id)) {
          report = reports[i];
          break;
        }
      }
    }
    if (!report && reports.length) report = reports[0];
    if (!report) return;
    var host = document.querySelector("[" + MARK + "]");
    if (!host) {
      host = document.createElement("div");
      host.setAttribute(MARK, "pending");
      var app = document.getElementById("app") || document.body;
      app.insertBefore(host, app.firstChild ? app.firstChild.nextSibling : null);
      // Prefer inserting near page content
      var page = document.querySelector("uni-page-body") || document.querySelector(".uni-page-body") || app;
      if (page && page !== host.parentNode) page.insertBefore(host, page.firstChild);
    }
    render(host, report);
  }
  function boot() {
    mount();
    setInterval(mount, 1200);
    window.addEventListener("hashchange", mount);
    window.addEventListener("popstate", mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
