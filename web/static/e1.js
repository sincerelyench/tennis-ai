(function () {
  const GUIDE_KEYS = ["side", "full_body", "racket"];
  const MAX_BYTES = 400 * 1024 * 1024;
  const MIN_BYTES = 1000;
  const state = {
    lang: "zh-CN",
    catalogs: null,
    auth: null,
    guide: { side: false, full_body: false, racket: false },
    code: "",
    stroke: "forehand",
    video: null,
    duration: 0,
    errorCode: "",
    errorText: "",
    notice: "",
    loading: false,
    job: null,
    jobErrorCode: "",
    jobErrorText: "",
    pollTimer: 0,
  };
  let pollSeq = 0;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"]/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
    }[ch]));
  }

  function pack() {
    return state.catalogs[state.lang] || state.catalogs["zh-CN"];
  }

  function text(path, vars) {
    const parts = path.split(".");
    let cur = pack();
    for (let i = 0; i < parts.length; i += 1) {
      if (!cur || typeof cur !== "object") return path;
      cur = cur[parts[i]];
    }
    if (typeof cur !== "string") return path;
    let out = cur;
    Object.keys(vars || {}).forEach((key) => {
      out = out.split("{{" + key + "}}").join(String(vars[key]));
    });
    return out;
  }

  function hasText(path) {
    const parts = path.split(".");
    let cur = pack();
    for (let i = 0; i < parts.length; i += 1) {
      if (!cur || typeof cur !== "object") return false;
      cur = cur[parts[i]];
    }
    return typeof cur === "string";
  }

  function validAuth() {
    return !!(state.auth && state.auth.token && state.auth.expiresAt > Date.now());
  }

  function clientName() {
    return (navigator.userAgent || "").indexOf("ZhangqiuAndroid") >= 0 ? "android" : "e1";
  }

  function guideDone() {
    return GUIDE_KEYS.every((key) => !!state.guide[key]);
  }

  function guideCount() {
    return GUIDE_KEYS.filter((key) => state.guide[key]).length;
  }

  function currentRoute() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const splitAt = raw.indexOf("?");
    const path = (splitAt >= 0 ? raw.slice(0, splitAt) : raw).replace(/^\//, "");
    const query = splitAt >= 0 ? raw.slice(splitAt + 1) : "";
    const params = new URLSearchParams(query);
    if (path === "guide") return { name: "guide" };
    if (path === "upload") return { name: "upload" };
    if (path === "queue") return { name: "queue", job: params.get("job") || "" };
    return { name: "home" };
  }

  function sizeLabel(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function clearError() {
    state.errorCode = "";
    state.errorText = "";
  }

  function setErrorCode(code) {
    state.errorCode = code || "";
    state.errorText = "";
  }

  function shownError() {
    if (state.errorCode && hasText("errors." + state.errorCode)) return text("errors." + state.errorCode);
    return state.errorText || "";
  }

  function clearJobError() {
    state.jobErrorCode = "";
    state.jobErrorText = "";
  }

  function setJobErrorCode(code) {
    state.jobErrorCode = code || "";
    state.jobErrorText = "";
  }

  function shownJobError() {
    if (state.jobErrorCode && hasText("errors." + state.jobErrorCode)) return text("errors." + state.jobErrorCode);
    return state.jobErrorText || "";
  }

  function captureError(body, status, ok) {
    const code = body && body.code;
    if (code && hasText("errors." + code)) {
      setErrorCode(code);
      return;
    }
    if (status === 401) { setErrorCode("auth_invalid"); return; }
    if (status === 409) { setErrorCode("busy"); return; }
    if (status === 413) { setErrorCode("video_too_large"); return; }
    if (status >= 500) { setErrorCode("server"); return; }
    if (ok) { setErrorCode("bad_response"); return; }
    state.errorCode = "";
    if (body && typeof body.detail === "string" && state.lang === "zh-CN") state.errorText = body.detail;
    else setErrorCode("generic");
  }

  function header() {
    const copy = pack();
    return (
      '<header class="top">' +
      '<div class="brand">' + esc(copy.appTitle) + "</div>" +
      '<div class="langs" role="group">' +
      '<button type="button" data-lang="zh-CN" class="' + (state.lang === "zh-CN" ? "on" : "") + '">' + esc(copy.lang.zh) + "</button>" +
      '<button type="button" data-lang="en" class="' + (state.lang === "en" ? "on" : "") + '">' + esc(copy.lang.en) + "</button>" +
      "</div></header>"
    );
  }

  function homeView() {
    const loggedIn = validAuth();
    return (
      header() +
      '<section class="card">' +
      '<div class="ball" aria-hidden="true"></div>' +
      "<h1>" + esc(pack().appTitle) + "</h1>" +
      '<p class="lead">' + esc(text("home.lead")) + "</p>" +
      '<p class="sub">' + esc(text("home.sub")) + "</p>" +
      '<p class="hint">' + esc(text("home.devNote")) + "</p>" +
      (loggedIn ? '<p class="ok">' + esc(text("home.loggedIn")) + "</p>" : "") +
      (state.notice ? '<p class="hint">' + esc(state.notice) + "</p>" : "") +
      '<label for="code">' + esc(text("home.codeLabel")) + "</label>" +
      '<input id="code" type="text" maxlength="128" autocomplete="off" placeholder="' + esc(text("home.codePlaceholder")) + '" value="' + esc(state.code) + '" />' +
      '<button class="primary" type="button" id="primary"' + (state.loading ? " disabled" : "") + ">" +
      esc(state.loading ? text("home.loggingIn") : (loggedIn ? text("home.continue") : text("home.login"))) +
      "</button>" +
      '<p class="error" id="error">' + esc(shownError()) + "</p>" +
      "</section>"
    );
  }

  function guideView() {
    const items = pack().guide.items.map((item) => (
      '<button type="button" class="check" data-key="' + esc(item.key) + '" aria-pressed="' + (state.guide[item.key] ? "true" : "false") + '">' +
      '<span class="box"></span><span><strong>' + esc(item.title) + "</strong><small>" + esc(item.desc) + "</small></span></button>"
    )).join("");
    return (
      header() +
      '<section class="card">' +
      '<p class="kicker">' + esc(text("guide.title")) + "</p>" +
      "<h1>" + esc(text("guide.title")) + "</h1>" +
      '<p class="sub">' + esc(text("guide.intro")) + "</p>" +
      items +
      '<p class="ok">' + esc(text("guide.progress", { done: guideCount(), total: GUIDE_KEYS.length })) + "</p>" +
      '<p class="hint">' + esc(text("guide.incompleteHint")) + "</p>" +
      '<button class="primary" type="button" id="next">' + esc(text("guide.continue")) + "</button>" +
      "</section>"
    );
  }

  function uploadView() {
    const chosen = state.video
      ? text("upload.chosen", { name: state.video.name || "video", size: sizeLabel(state.video.size) })
      : text("upload.none");
    return (
      header() +
      '<section class="card">' +
      '<p class="kicker">' + esc(text("upload.title")) + "</p>" +
      "<h1>" + esc(text("upload.title")) + "</h1>" +
      '<p class="sub">' + esc(text("upload.intro")) + "</p>" +
      '<p class="' + (guideDone() ? "ok" : "hint") + '">' + esc(text(guideDone() ? "upload.guideDone" : "upload.guideSkipped")) + "</p>" +
      '<p class="hint">' + esc(text("upload.strokeLabel")) + "</p>" +
      '<div class="seg">' +
      '<button type="button" data-stroke="forehand" class="' + (state.stroke === "forehand" ? "on" : "") + '">' + esc(text("upload.forehand")) + "</button>" +
      '<button type="button" data-stroke="backhand" class="' + (state.stroke === "backhand" ? "on" : "") + '">' + esc(text("upload.backhand")) + "</button>" +
      "</div>" +
      '<div class="row">' +
      '<button class="ghost" type="button" id="pick">' + esc(text("upload.choose")) + "</button>" +
      '<button class="ghost" type="button" id="record">' + esc(text("upload.record")) + "</button>" +
      "</div>" +
      '<input id="file-album" class="sr" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v,.avi" />' +
      '<input id="file-cam" class="sr" type="file" accept="video/*" capture="environment" />' +
      "<p>" + esc(chosen) + "</p>" +
      (state.duration > 20 ? '<p class="hint">' + esc(text("upload.longClip")) + "</p>" : "") +
      '<button class="primary" type="button" id="submit"' + (state.loading ? " disabled" : "") + ">" +
      esc(state.loading ? text("upload.uploading") : text("upload.submit")) +
      "</button>" +
      '<p class="error">' + esc(shownError()) + "</p>" +
      "</section>"
    );
  }

  function statusLabel(status) {
    if (hasText("queue." + status)) return text("queue." + status);
    return text("queue.unknown");
  }

  function queueView(route) {
    const job = state.job;
    const status = job && job.status ? job.status : "unknown";
    const terminal = status === "done" || status === "error" || status === "cancelled";
    const guideFlag = job && job.metadata ? job.metadata.guide_completed : null;
    let guideLine = "";
    if (guideFlag === true) guideLine = '<p class="ok">' + esc(text("queue.guideDone")) + "</p>";
    if (guideFlag === false) guideLine = '<p class="hint">' + esc(text("queue.guideSkipped")) + "</p>";
    const server = job && (status === "error" || status === "cancelled") && job.message
      ? '<p class="error"><strong>' + esc(text("queue.serverDetail")) + "</strong><br />" + esc(job.message) + "</p>"
      : "";
    return (
      header() +
      '<section class="card">' +
      '<p class="kicker">' + esc(text("queue.title")) + "</p>" +
      "<h1>" + (terminal ? "" : '<span class="pulse"></span>') + esc(statusLabel(status)) + "</h1>" +
      '<p class="jobid">' + esc(text("queue.jobId", { id: (job && job.id) || route.job || "—" })) + "</p>" +
      (terminal ? "" : '<p class="hint">' + esc(text("queue.polling")) + "</p>") +
      guideLine +
      (status === "done" ? '<p class="sub">' + esc(text("queue.doneHint")) + "</p>" : "") +
      server +
      (shownJobError() ? '<p class="error">' + esc(shownJobError()) + "</p>" : "") +
      '<button class="primary" type="button" id="home">' + esc(text("queue.home")) + "</button>" +
      (status === "error" || status === "cancelled" || shownJobError()
        ? '<button class="ghost" type="button" id="retry">' + esc(text("queue.retry")) + "</button>"
        : "") +
      "</section>"
    );
  }

  function view() {
    const route = currentRoute();
    if (route.name === "guide") return guideView();
    if (route.name === "upload") return uploadView();
    if (route.name === "queue") return queueView(route);
    return homeView();
  }

  function render() {
    document.documentElement.lang = state.lang;
    document.title = pack().appTitle;
    document.getElementById("app").innerHTML = view();
    bind();
  }

  function setLang(lang) {
    state.lang = lang === "en" ? "en" : "zh-CN";
    localStorage.setItem("zq_lang", state.lang);
    render();
  }

  function saveGuide() {
    sessionStorage.setItem("zq_guide", JSON.stringify(state.guide));
  }

  function stopPoll() {
    pollSeq += 1;
    clearTimeout(state.pollTimer);
  }

  function startPoll(jobId) {
    const seq = pollSeq;
    const tick = async function () {
      if (seq !== pollSeq) return;
      if (currentRoute().name !== "queue") return;
      try {
        const res = await fetch("/api/jobs/" + encodeURIComponent(jobId));
        let body = null;
        try { body = await res.json(); } catch (e) { body = null; }
        if (seq !== pollSeq) return;
        if (!res.ok || !body) {
          const code = body && body.code;
          setJobErrorCode(code && hasText("errors." + code) ? code : "generic");
        } else {
          state.job = body;
          clearJobError();
        }
        render();
        const status = state.job && state.job.status;
        if (status === "done" || status === "error" || status === "cancelled") return;
        state.pollTimer = setTimeout(tick, 2000);
      } catch (e) {
        if (seq !== pollSeq) return;
        setJobErrorCode("network");
        render();
        state.pollTimer = setTimeout(tick, 3000);
      }
    };
    tick();
  }

  async function readDuration(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      const done = (value) => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      video.preload = "metadata";
      video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : 0);
      video.onerror = () => done(0);
      video.src = url;
    });
  }

  function namedFile(file) {
    const name = file.name || "";
    if (/\.(mp4|mov|webm|m4v|avi)$/i.test(name)) return file;
    let ext = ".mp4";
    const type = file.type || "";
    if (type.indexOf("webm") >= 0) ext = ".webm";
    else if (type.indexOf("quicktime") >= 0) ext = ".mov";
    try {
      return new File([file], "swing" + ext, { type: file.type || "video/mp4" });
    } catch (e) {
      return file;
    }
  }

  async function useFile(file) {
    if (!file) return;
    state.video = namedFile(file);
    state.duration = 0;
    clearError();
    const type = state.video.type || "";
    const named = /\.(mp4|mov|webm|m4v|avi)$/i.test(state.video.name || "");
    if (!named && type && type.indexOf("video/") !== 0) {
      state.video = null;
      setErrorCode("video_type");
      render();
      return;
    }
    if (state.video.size > MAX_BYTES) {
      state.video = null;
      setErrorCode("video_too_large");
      render();
      return;
    }
    if (state.video.size && state.video.size < MIN_BYTES) {
      state.video = null;
      setErrorCode("video_too_small");
      render();
      return;
    }
    render();
    const duration = await readDuration(state.video);
    if (state.video && duration) {
      state.duration = duration;
      render();
    }
  }

  async function login() {
    if (validAuth() && !state.code.trim()) {
      location.hash = "#/guide";
      return;
    }
    const typed = state.code.trim();
    const code = typed || ("dev-" + Date.now().toString(36));
    state.loading = true;
    clearError();
    state.notice = typed ? "" : state.notice;
    render();
    try {
      const res = await fetch("/api/auth/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code }),
      });
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (!res.ok || !body || !body.token) {
        state.loading = false;
        captureError(body, res.status, false);
        render();
        return;
      }
      state.auth = {
        token: body.token,
        userId: body.user && body.user.id,
        expiresAt: Date.now() + Number(body.expires_in || 0) * 1000,
      };
      localStorage.setItem("zq_auth", JSON.stringify(state.auth));
      state.loading = false;
      clearError();
      location.hash = "#/guide";
    } catch (e) {
      state.loading = false;
      setErrorCode("network");
      render();
    }
  }

  async function upload() {
    if (!validAuth()) {
      setErrorCode("auth_required");
      render();
      return;
    }
    if (!state.video) {
      setErrorCode("video_required");
      render();
      return;
    }
    const file = state.video;
    if (file.size > MAX_BYTES) {
      setErrorCode("video_too_large");
      render();
      return;
    }
    if (file.size < MIN_BYTES) {
      setErrorCode("video_too_small");
      render();
      return;
    }
    state.loading = true;
    clearError();
    render();
    const body = new FormData();
    body.append("video", file, file.name || "swing.mp4");
    body.append("stroke", state.stroke);
    body.append("client", clientName());
    body.append("sample", "0");
    body.append("level", "3.0");
    body.append("title", "涨球挥拍分析");
    body.append("guide_completed", guideDone() ? "1" : "0");
    body.append("guide_checks", JSON.stringify(state.guide));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { Authorization: "Bearer " + state.auth.token },
        body: body,
      });
      let payload = null;
      try { payload = await res.json(); } catch (e) { payload = null; }
      if (!res.ok || !payload || !payload.job_id) {
        state.loading = false;
        if (res.ok) setErrorCode("bad_response");
        else captureError(payload, res.status, false);
        render();
        return;
      }
      state.loading = false;
      state.job = null;
      clearJobError();
      location.hash = "#/queue?job=" + encodeURIComponent(payload.job_id);
    } catch (e) {
      state.loading = false;
      setErrorCode("network");
      render();
    }
  }

  function bind() {
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => setLang(button.getAttribute("data-lang")));
    });
    const code = document.getElementById("code");
    if (code) {
      code.addEventListener("input", () => { state.code = code.value; });
    }
    const primary = document.getElementById("primary");
    if (primary) primary.addEventListener("click", login);
    document.querySelectorAll(".check").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-key");
        if (GUIDE_KEYS.indexOf(key) < 0) return;
        state.guide[key] = !state.guide[key];
        saveGuide();
        render();
      });
    });
    const next = document.getElementById("next");
    if (next) next.addEventListener("click", () => { location.hash = "#/upload"; });
    document.querySelectorAll("[data-stroke]").forEach((button) => {
      button.addEventListener("click", () => {
        state.stroke = button.getAttribute("data-stroke") === "backhand" ? "backhand" : "forehand";
        render();
      });
    });
    const album = document.getElementById("file-album");
    const camera = document.getElementById("file-cam");
    const pick = document.getElementById("pick");
    const record = document.getElementById("record");
    if (pick && album) pick.addEventListener("click", () => album.click());
    if (record && camera) record.addEventListener("click", () => camera.click());
    if (album) album.addEventListener("change", () => useFile(album.files && album.files[0]));
    if (camera) camera.addEventListener("change", () => useFile(camera.files && camera.files[0]));
    const submit = document.getElementById("submit");
    if (submit) submit.addEventListener("click", upload);
    const home = document.getElementById("home");
    if (home) home.addEventListener("click", () => { location.hash = "#/"; });
    const retry = document.getElementById("retry");
    if (retry) retry.addEventListener("click", () => { location.hash = "#/upload"; });
  }

  function onRoute() {
    stopPoll();
    const route = currentRoute();
    if (route.name !== "home" && !validAuth()) {
      location.hash = "#/";
      return;
    }
    clearError();
    render();
    if (route.name === "queue" && route.job) startPoll(route.job);
    if (route.name === "queue" && !route.job) {
      setJobErrorCode("bad_response");
      render();
    }
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const requested = params.get("lang");
    if (requested === "en" || requested === "zh-CN") state.lang = requested;
    else state.lang = localStorage.getItem("zq_lang") === "en" ? "en" : "zh-CN";
    try {
      const [zh, en] = await Promise.all([
        fetch("/i18n/zh-CN.json", { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error("i18n");
          return res.json();
        }),
        fetch("/i18n/en.json", { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error("i18n");
          return res.json();
        }),
      ]);
      state.catalogs = { "zh-CN": zh, en: en };
    } catch (e) {
      document.getElementById("app").innerHTML = '<p class="error">文案加载失败，请确认后端已启动。<br />Could not load copy. Start the local server.</p>';
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem("zq_guide") || "null");
      if (saved && typeof saved === "object") {
        GUIDE_KEYS.forEach((key) => { state.guide[key] = !!saved[key]; });
      }
    } catch (e) { /* keep defaults */ }
    try {
      const auth = JSON.parse(localStorage.getItem("zq_auth") || "null");
      if (auth && auth.token) state.auth = auth;
    } catch (e) { state.auth = null; }
    window.addEventListener("hashchange", onRoute);
    if (!location.hash) location.hash = "#/";
    else onRoute();
  }

  boot();
})();
