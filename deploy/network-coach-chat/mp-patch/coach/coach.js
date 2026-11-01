const { getLang, setLang } = require("../../utils/i18n");
const {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  DEFAULT_COACH_NAME_EN,
  getSelectedCoachId,
  listPublished,
  normalizeDisplayName,
} = require("../../utils/coach-publish");

function scrub(name, locale) {
  const raw = String(name || "").trim();
  if (!raw || /poppy|东东|dongdong|掌球/i.test(raw)) {
    return locale === "en" ? DEFAULT_COACH_NAME_EN : DEFAULT_COACH_NAME_ZH;
  }
  return raw;
}

Page({
  data: {
    locale: "zh-CN",
    activeId: DEFAULT_COACH_ID,
    network: null,
    messages: [],
    draft: "",
    pending: false,
  },

  onShow() {
    const locale = getLang();
    this.setData({ locale });
    this.refreshPersonas();
    if (!this.data.messages.length) this.bootstrap();
  },

  refreshPersonas() {
    const locale = this.data.locale;
    const selected = getSelectedCoachId();
    let network = null;
    if (selected && selected !== DEFAULT_COACH_ID && selected !== "poppy") {
      const card = listPublished().find((p) => p.coachId === selected);
      network = {
        id: selected,
        name: scrub(card ? card.displayName : selected, locale === "en" ? "en" : "zh"),
        style: card ? card.styleTagline || "" : "",
      };
    }
    this.setData({ network });
  },

  bootstrap() {
    const hello = this.helloText(this.data.activeId);
    this.setData({
      messages: [{ id: 1, role: "coach", text: hello }],
      history: [{ role: "assistant", content: hello }],
    });
  },

  helloText(id) {
    const zh = this.data.locale !== "en";
    if (id === DEFAULT_COACH_ID || id === "poppy") {
      return zh
        ? "我是涨球教练。一次一条提示，先把击球点送到身前。"
        : "I’m Zhangqiu Coach. One cue at a time — meet the ball out front.";
    }
    const n = (this.data.network && this.data.network.name) || (zh ? "网络教练" : "Network coach");
    return zh
      ? `你好，我是${n}。可以直接问技术问题，我会按我的风格回答。`
      : `Hi, I’m ${n}. Ask technique questions and I’ll answer in my style.`;
  },

  onPickPersona(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ activeId: id, draft: "" });
    const hello = this.helloText(id);
    this.setData({
      messages: [{ id: Date.now(), role: "coach", text: hello }],
      history: [{ role: "assistant", content: hello }],
    });
  },

  onOpenPicker() {
    wx.navigateTo({ url: "/pages/coach-picker/coach-picker" });
  },

  onDraft(e) {
    this.setData({ draft: e.detail.value });
  },

  onSend() {
    const text = String(this.data.draft || "").trim();
    if (!text || this.data.pending) return;
    const zh = this.data.locale !== "en";
    const history = (this.data.history || []).concat([{ role: "user", content: text }]);
    const messages = this.data.messages.concat([{ id: Date.now(), role: "user", text }]);
    this.setData({ draft: "", pending: true, history, messages });

    const { apiBase } = require("../../config");
    const finish = (reply) => {
      this.setData({
        pending: false,
        history: history.concat([{ role: "assistant", content: reply }]),
        messages: messages.concat([{ id: Date.now() + 1, role: "coach", text: reply }]),
      });
    };

    wx.request({
      url: `${apiBase}/api/coach/chat`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: {
        messages: history.slice(-20),
        confirmedDaily: true,
        confirmedImprove: false,
        coachId: this.data.activeId,
        locale: zh ? "zh-CN" : "en",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.text) finish(res.data.text);
        else finish(this.localReply(text));
      },
      fail: () => finish(this.localReply(text)),
    });
  },

  localReply(q) {
    const zh = this.data.locale !== "en";
    if (this.data.activeId === DEFAULT_COACH_ID || this.data.activeId === "poppy") {
      return zh
        ? `涨球教练：关于「${q.slice(0, 36)}」——先把击球点再往身前送一个拍头。`
        : `Zhangqiu Coach: On “${q.slice(0, 36)}” — meet it farther in front.`;
    }
    const n = (this.data.network && this.data.network.name) || (zh ? "网络教练" : "Network coach");
    return zh
      ? `${n}：先碎步找位再送拍。你问的是「${q.slice(0, 36)}」。`
      : `${n}: Split-step, then send. You asked “${q.slice(0, 36)}”.`;
  },

  onToggleLang() {
    const next = this.data.locale === "en" ? "zh-CN" : "en";
    setLang(next);
    this.setData({ locale: next });
    this.refreshPersonas();
    this.bootstrap();
  },
});
