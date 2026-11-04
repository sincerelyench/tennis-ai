/*! 涨球 · report 正确动作按问题点匹配示范 (APK/IPA/uni-app www) */
(function () {
  var MARK = "data-zq-correct-by-issues";
  var AXIS_LOW = { 重心: 18, 击球点: 14, 动力链: 20, 击球效果: 18 };
  var AXIS_KEY = { 重心: "balance", 击球点: "contact", 动力链: "chain", 击球效果: "effect" };
  var AXIS_LABEL = {
    balance: { zh: "重心", en: "Balance" },
    contact: { zh: "击球点", en: "Contact" },
    chain: { zh: "动力链", en: "Kinetic chain" },
    effect: { zh: "击球效果", en: "Ball effect" },
  };
  var RULES = [
    { test: /重心|直腿|站得|头肩|weight|straight leg/i, id: "weight", axis: "重心", zh: "重心偏高 / 不稳", en: "Balance too high / unstable" },
    { test: /步幅偏窄|开立不够|站位|stance too narrow/i, id: "stance", axis: "重心", zh: "站位偏窄", en: "Stance too narrow" },
    { test: /击球点.*晚|太后|偏晚|contact late|late_contact/i, id: "late", axis: "击球点", zh: "击球点偏晚", en: "Contact late" },
    { test: /击球点.*低|contact too low|contact_low/i, id: "contact_low", axis: "击球点", zh: "击球点偏低", en: "Contact too low" },
    { test: /转肩|转髋|动力链|只动手|shoulder turn|kinetic chain/i, id: "turn", axis: "动力链", zh: "动力链断裂 / 转体不足", en: "Kinetic chain / short turn" },
    { test: /引拍|后摆偏浅|takeback/i, id: "takeback", axis: "动力链", zh: "引拍偏浅", en: "Shallow takeback" },
    { test: /拍头偏慢|速度偏慢|擦玻璃|随挥|follow-?through/i, id: "effect", axis: "击球效果", zh: "击球效果偏弱", en: "Weak ball effect" },
  ];

  function isReport() {
    return /\/pages\/report\//.test(location.href || "") || /#\/pages\/report\//.test(location.href || "");
  }

  function langIsEn() {
    try {
      var raw = localStorage.getItem("tennis-locale") || localStorage.getItem("zq-locale") || "";
      return /^en/i.test(raw);
    } catch (e) {
      return false;
    }
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
    var m =
      href.match(/[?&#/](?:reportId|id)=([^&#]+)/i) ||
      href.match(/\/pages\/report\/[^?]+\?[^#]*id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    m = href.match(/report(?:s)?\/([a-zA-Z0-9_-]{6,64})/);
    return m ? m[1] : "";
  }

  function detectIssues(findings, scores) {
    var out = [];
    var seen = {};
    (findings || []).forEach(function (line) {
      RULES.forEach(function (rule) {
        if (seen[rule.id]) return;
        if (!rule.test.test(String(line || ""))) return;
        seen[rule.id] = true;
        out.push(rule);
      });
    });
    var axesHit = {};
    out.forEach(function (r) {
      axesHit[r.axis] = true;
    });
    Object.keys(AXIS_LOW).forEach(function (axis) {
      if (axesHit[axis]) return;
      var score = scores && (scores[axis] != null ? scores[axis] : scores[AXIS_KEY[axis]]);
      if (typeof score !== "number" || score > AXIS_LOW[axis]) return;
      var id = "axis-" + AXIS_KEY[axis];
      if (seen[id]) return;
      seen[id] = true;
      out.push({
        id: id,
        axis: axis,
        zh: axis + "偏弱",
        en: (AXIS_LABEL[AXIS_KEY[axis]] || {}).en + " needs work",
      });
    });
    return out.slice(0, 4);
  }

  function ensurePanel(host, issues) {
    if (!host) return;
    var existing = host.querySelector("[" + MARK + "]");
    if (existing) existing.remove();
    if (!issues.length) return;
    var en = langIsEn();
    var box = document.createElement("div");
    box.setAttribute(MARK, "1");
    box.setAttribute("data-issue-demos", "true");
    box.setAttribute("data-issue-count", String(issues.length));
    box.style.cssText = "margin:12px 0;padding:0 12px;";
    var lead = document.createElement("p");
    lead.style.cssText = "font-size:12px;font-weight:600;margin:0 0 8px;color:#0f172a;";
    lead.textContent = en
      ? "Correct form · matched to " + issues.length + " problem points"
      : "正确动作 · 按 " + issues.length + " 个问题点匹配";
    box.appendChild(lead);
    issues.forEach(function (issue) {
      var card = document.createElement("div");
      card.setAttribute("data-visual", "good-issue");
      card.setAttribute("data-issue-id", issue.id);
      card.setAttribute("data-issue-axis", AXIS_KEY[issue.axis] || "");
      card.style.cssText =
        "border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:0 0 8px;background:#fff;";
      var axis = AXIS_LABEL[AXIS_KEY[issue.axis]] || { zh: issue.axis, en: issue.axis };
      card.innerHTML =
        '<div style="font-size:11px;font-weight:600;color:#0d9488;">' +
        (en ? "Correct form" : "正确动作") +
        " · " +
        (en ? axis.en : axis.zh) +
        '</div><div style="font-size:13px;font-weight:600;margin-top:4px;" data-issue-label="true">' +
        (en ? issue.en : issue.zh) +
        "</div>";
      box.appendChild(card);
    });
    var good = host.querySelector('[data-visual="good"]') || host;
    good.parentNode ? good.parentNode.insertBefore(box, good.nextSibling) : host.appendChild(box);
  }

  function run() {
    if (!isReport()) return;
    var id = currentReportId();
    var reports = readReports();
    var report = reports.find(function (r) {
      return r && r.id === id;
    }) || reports[0];
    if (!report) return;
    var issues = detectIssues(report.findings || report.problems || [], report.scores || {});
    var host =
      document.querySelector('[data-section="visual-coach"]') ||
      document.querySelector("#star-box") ||
      document.querySelector(".annot-box") ||
      document.body;
    ensurePanel(host, issues);
  }

  function boot() {
    run();
    setTimeout(run, 800);
    setTimeout(run, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("hashchange", boot);
})();
