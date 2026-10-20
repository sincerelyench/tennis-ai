const { getLang, setLang } = require("../../utils/i18n");
const {
  COACH_DISPLAY_NAME_ZH,
  COACH_LIBRARY_STROKES,
  readLibrary,
  upsertEntry,
  writeLibrary,
} = require("../../utils/coach-stroke-library");
const {
  DEFAULT_COACH_NAME_ZH,
  readPublish,
  writePublish,
  submitForTraining,
  requestPublish,
  withdraw,
  statusLabel,
} = require("../../utils/coach-publish");

const LABELS = {
  "zh-CN": {
    "fh-topspin": "正手上旋",
    "fh-slice": "正手切削",
    "fh-volley": "正手截击",
    "bh-topspin": "反手上旋",
    "bh-slice": "反手切削",
    "bh-volley": "反手截击",
    serve: "发球",
    smash: "高压球",
  },
  en: {
    "fh-topspin": "Forehand topspin",
    "fh-slice": "Forehand slice",
    "fh-volley": "Forehand volley",
    "bh-topspin": "Backhand topspin",
    "bh-slice": "Backhand slice",
    "bh-volley": "Backhand volley",
    serve: "Serve",
    smash: "Overhead smash",
  },
};

Page({
  data: {
    locale: "zh-CN",
    coachName: COACH_DISPLAY_NAME_ZH,
    strokes: COACH_LIBRARY_STROKES,
    strokeId: "fh-topspin",
    strokeLabels: [],
    prompt: "",
    title: "",
    videoUrl: "",
    phase: "loading",
    busy: false,
    flash: "",
    filled: {},
    publishStatus: "draft",
    publishStatusLabel: "草稿",
    trainProgress: null,
    displayName: DEFAULT_COACH_NAME_ZH,
    styleTagline: "",
    canTrain: false,
    canPublish: false,
    canWithdraw: false,
    pubBusy: false,
    pubFlash: "",
    filledCount: 0,
  },

  onShow() {
    const locale = getLang();
    this.setData({ locale, coachName: COACH_DISPLAY_NAME_ZH });
    this.refreshLabels();
    this.load();
    this.refreshPublish();
  },

  countFilled() {
    const lib = readLibrary();
    let n = 0;
    COACH_LIBRARY_STROKES.forEach((id) => {
      const e = lib.entries[id];
      if (e && ((e.prompt || "").trim() || (e.videoUrl || "").trim())) n += 1;
    });
    return n;
  },

  refreshPublish() {
    const locale = this.data.locale === "en" ? "en" : "zh";
    const filledCount = this.countFilled();
    let p = readPublish("poppy");
    p.libraryStrokeCount = filledCount;
    p = writePublish(p);
    const canTrain =
      filledCount > 0 && (p.status === "draft" || p.status === "rejected");
    const canPublish = p.status === "ready";
    const canWithdraw = [
      "queued",
      "training",
      "ready",
      "pending_review",
      "published",
    ].includes(p.status);
    this.setData({
      publishStatus: p.status,
      publishStatusLabel: statusLabel(p.status, locale),
      trainProgress:
        p.trainJob && (p.status === "queued" || p.status === "training")
          ? p.trainJob.progress
          : null,
      displayName: p.displayName || DEFAULT_COACH_NAME_ZH,
      styleTagline: p.styleTagline || "",
      canTrain,
      canPublish,
      canWithdraw,
      filledCount,
    });
    if (p.status === "queued" || p.status === "training") {
      clearTimeout(this._pubPoll);
      this._pubPoll = setTimeout(() => this.refreshPublish(), 1000);
    }
  },

  onDisplayName(e) {
    this.setData({ displayName: e.detail.value });
  },
  onStyleTagline(e) {
    this.setData({ styleTagline: e.detail.value });
  },

  onSubmitTrain() {
    this.setData({ pubBusy: true, pubFlash: "" });
    const count = this.countFilled();
    const next = submitForTraining(
      Object.assign(readPublish("poppy"), {
        displayName: this.data.displayName,
        styleTagline: this.data.styleTagline,
      }),
      count,
    );
    writePublish(next);
    this.setData({
      pubBusy: false,
      pubFlash: this.data.locale === "en" ? "Training submitted" : "已提交训练",
    });
    this.refreshPublish();
    const { apiBase } = require("../../config");
    wx.request({
      url: `${apiBase}/api/coach/train?coachId=poppy`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: {
        libraryStrokeCount: count,
        displayName: this.data.displayName,
        styleTagline: this.data.styleTagline,
      },
    });
  },

  onRequestPublish() {
    this.setData({ pubBusy: true, pubFlash: "" });
    requestPublish(readPublish("poppy"), this.data.displayName, this.data.styleTagline);
    this.setData({
      pubBusy: false,
      pubFlash: this.data.locale === "en" ? "Published" : "已申请发布",
    });
    this.refreshPublish();
    const { apiBase } = require("../../config");
    wx.request({
      url: `${apiBase}/api/coach/publish?coachId=poppy`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: {
        action: "request",
        displayName: this.data.displayName,
        styleTagline: this.data.styleTagline,
      },
    });
  },

  onWithdraw() {
    this.setData({ pubBusy: true, pubFlash: "" });
    withdraw(readPublish("poppy"));
    this.setData({
      pubBusy: false,
      pubFlash: this.data.locale === "en" ? "Withdrawn" : "已撤回",
    });
    this.refreshPublish();
    const { apiBase } = require("../../config");
    wx.request({
      url: `${apiBase}/api/coach/publish?coachId=poppy`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: { action: "withdraw" },
    });
  },

  refreshLabels() {
    const locale = this.data.locale === "en" ? "en" : "zh-CN";
    const map = LABELS[locale];
    const filled = {};
    const lib = readLibrary();
    const labels = COACH_LIBRARY_STROKES.map((id) => {
      const e = lib.entries[id];
      filled[id] = !!(e && ((e.prompt || "").trim() || (e.videoUrl || "").trim()));
      return { id, label: map[id] || id, filled: filled[id] };
    });
    this.setData({ strokeLabels: labels, filled });
  },

  applyStroke(lib) {
    const e = (lib.entries || {})[this.data.strokeId] || {};
    this.setData({
      prompt: e.prompt || "",
      title: e.title || "",
      videoUrl: e.videoUrl || "",
    });
  },

  load() {
    this.setData({ phase: "loading" });
    const { apiBase } = require("../../config");
    wx.request({
      url: `${apiBase}/api/coach/library?coachId=poppy`,
      method: "GET",
      success: (res) => {
        let lib = readLibrary();
        if (res.statusCode === 200 && res.data && res.data.library) {
          lib = res.data.library;
          writeLibrary(lib);
        }
        this.applyStroke(lib);
        this.setData({ phase: "ready" });
        this.refreshLabels();
      },
      fail: () => {
        const lib = readLibrary();
        this.applyStroke(lib);
        this.setData({ phase: "ready" });
        this.refreshLabels();
      },
    });
  },

  onPickStroke(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ strokeId: id }, () => {
      this.applyStroke(readLibrary());
    });
  },

  onPrompt(e) {
    this.setData({ prompt: e.detail.value });
  },
  onTitle(e) {
    this.setData({ title: e.detail.value });
  },
  onUrl(e) {
    this.setData({ videoUrl: e.detail.value });
  },

  onChooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        const videoUrl = f.tempFilePath;
        this.setData({ videoUrl });
        upsertEntry(this.data.strokeId, {
          prompt: this.data.prompt,
          title: this.data.title,
          videoUrl,
        });
        this.setData({ flash: this.data.locale === "en" ? "Video selected" : "已选视频" });
        this.refreshLabels();
      },
    });
  },

  onSave() {
    this.setData({ busy: true, flash: "" });
    const { apiBase } = require("../../config");
    const body = {
      strokeId: this.data.strokeId,
      prompt: this.data.prompt,
      title: this.data.title,
      videoUrl: this.data.videoUrl,
    };
    const finishLocal = () => {
      upsertEntry(this.data.strokeId, body);
      this.setData({
        busy: false,
        flash: this.data.locale === "en" ? "Saved" : "已保存",
      });
      this.refreshLabels();
      this.refreshPublish();
    };
    wx.request({
      url: `${apiBase}/api/coach/library?coachId=poppy`,
      method: "PUT",
      data: body,
      header: { "content-type": "application/json" },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.library) {
          writeLibrary(res.data.library);
          this.setData({
            busy: false,
            flash: this.data.locale === "en" ? "Saved" : "已保存",
          });
          this.refreshLabels();
          this.refreshPublish();
        } else {
          finishLocal();
        }
      },
      fail: finishLocal,
    });
  },

  onToggleLang() {
    const next = this.data.locale === "en" ? "zh-CN" : "en";
    setLang(next);
    this.setData({ locale: next });
    this.refreshLabels();
    this.refreshPublish();
  },
});
