const { t, getLocale, setLocale } = require("../../utils/i18n");
const {
  COACH_DISPLAY_NAME_ZH,
  COACH_LIBRARY_STROKES,
  readLibrary,
  upsertEntry,
  writeLibrary,
} = require("../../utils/coach-stroke-library");

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
  },

  onShow() {
    const locale = getLocale();
    this.setData({ locale, coachName: COACH_DISPLAY_NAME_ZH });
    this.refreshLabels();
    this.load();
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
        } else {
          finishLocal();
        }
      },
      fail: finishLocal,
    });
  },

  onToggleLang() {
    const next = this.data.locale === "en" ? "zh-CN" : "en";
    setLocale(next);
    this.setData({ locale: next });
    this.refreshLabels();
  },
});
