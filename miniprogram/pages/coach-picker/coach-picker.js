const { getLang, setLang } = require("../../utils/i18n");
const {
  DEFAULT_COACH_NAME_ZH,
  getSelectedCoachId,
  listPublished,
  normalizeDisplayName,
  setSelectedCoachId,
} = require("../../utils/coach-publish");

Page({
  data: {
    locale: "zh-CN",
    phase: "loading",
    coaches: [],
    selectedId: "poppy",
  },

  onShow() {
    this.setData({ locale: getLang(), selectedId: getSelectedCoachId() });
    this.load();
  },

  load() {
    this.setData({ phase: "loading" });
    const { apiBase } = require("../../config");
    const finishLocal = () => {
      const coaches = listPublished().map((p) => ({
        coachId: p.coachId,
        displayName: normalizeDisplayName(p.displayName) || DEFAULT_COACH_NAME_ZH,
        styleTagline: p.styleTagline || "",
        publishedAt: p.publishedAt,
        libraryStrokeCount: p.libraryStrokeCount || 0,
      }));
      this.setData({
        coaches,
        selectedId: getSelectedCoachId(),
        phase: "ready",
      });
    };
    wx.request({
      url: `${apiBase}/api/coaches?published=1`,
      method: "GET",
      success: (res) => {
        if (res.statusCode === 200 && res.data && Array.isArray(res.data.coaches)) {
          const coaches = res.data.coaches.map((c) =>
            Object.assign({}, c, {
              displayName: normalizeDisplayName(c.displayName) || DEFAULT_COACH_NAME_ZH,
            }),
          );
          this.setData({ coaches, phase: "ready", selectedId: getSelectedCoachId() });
        } else {
          finishLocal();
        }
      },
      fail: finishLocal,
    });
  },

  onPick(e) {
    const id = e.currentTarget.dataset.id;
    setSelectedCoachId(id);
    this.setData({ selectedId: id });
    const { apiBase } = require("../../config");
    wx.request({
      url: `${apiBase}/api/player/coach`,
      method: "PUT",
      header: { "content-type": "application/json" },
      data: { coachId: id },
    });
  },

  onToggleLang() {
    const next = this.data.locale === "en" ? "zh-CN" : "en";
    setLang(next);
    this.setData({ locale: next });
  },
});
