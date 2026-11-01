const { getLang, setLang } = require("../../utils/i18n");
const {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_ZH,
  DEFAULT_COACH_NAME_EN,
  getSelectedCoachId,
  listPublished,
  normalizeDisplayName,
} = require("../../utils/coach-publish");

const MSG_KEY = "tennis-network-coach-messages-v1";

function scrub(name, locale) {
  const raw = String(name || "").trim();
  if (!raw || /poppy|东东|dongdong|掌球/i.test(raw)) {
    return locale === "en" ? DEFAULT_COACH_NAME_EN : DEFAULT_COACH_NAME_ZH;
  }
  return raw;
}

function isAi(id) {
  return !id || id === DEFAULT_COACH_ID || id === "poppy" || id === "zhangqiu";
}

function readBoard(coachId) {
  try {
    const all = wx.getStorageSync(MSG_KEY) || {};
    const list = all[coachId];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function writeBoard(coachId, list) {
  try {
    const all = wx.getStorageSync(MSG_KEY) || {};
    all[coachId] = list.slice(-40);
    wx.setStorageSync(MSG_KEY, all);
  } catch (e) {}
}

function formatTime(iso, locale) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "";
  }
}

Page({
  data: {
    locale: "zh-CN",
    activeId: DEFAULT_COACH_ID,
    isAi: true,
    network: null,
    messages: [],
    board: [],
    draft: "",
    pending: false,
  },

  onShow() {
    const locale = getLang();
    this.setData({ locale });
    this.refreshPersonas();
    if (isAi(this.data.activeId)) {
      if (!this.data.messages.length) this.bootstrapAi();
    } else {
      this.loadBoard();
    }
  },

  refreshPersonas() {
    const locale = this.data.locale;
    const selected = getSelectedCoachId();
    let network = null;
    if (selected && !isAi(selected)) {
      const card = listPublished().find((p) => p.coachId === selected);
      network = {
        id: selected,
        name: scrub(card ? card.displayName : selected, locale === "en" ? "en" : "zh"),
        style: card ? card.styleTagline || "" : "",
      };
    }
    this.setData({ network });
  },

  bootstrapAi() {
    const hello =
      this.data.locale !== "en"
        ? "我是涨球教练（AI）。一次一条提示，先把击球点送到身前。"
        : "I’m Zhangqiu Coach (AI). One cue at a time — meet the ball out front.";
    this.setData({
      messages: [{ id: 1, role: "coach", text: hello }],
      history: [{ role: "assistant", content: hello }],
      board: [],
    });
  },

  loadBoard() {
    const locale = this.data.locale;
    const raw = readBoard(this.data.activeId);
    const board = raw.map((m) => ({
      ...m,
      atLabel: formatTime(m.at, locale === "en" ? "en" : "zh"),
    }));
    this.setData({ board, messages: [], history: [] });
  },

  onPickPersona(e) {
    const id = e.currentTarget.dataset.id;
    const ai = isAi(id);
    this.setData({ activeId: id, isAi: ai, draft: "" });
    if (ai) this.bootstrapAi();
    else this.loadBoard();
  },

  onOpenPicker() {
    wx.navigateTo({ url: "/pages/coach-picker/coach-picker" });
  },

  onDraft(e) {
    this.setData({ draft: e.detail.value });
  },

  onSend() {
    if (!this.data.isAi) return;
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
        coachId: DEFAULT_COACH_ID,
        locale: zh ? "zh-CN" : "en",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.text) finish(res.data.text);
        else finish(this.localAiReply(text));
      },
      fail: () => finish(this.localAiReply(text)),
    });
  },

  onLeave() {
    if (this.data.isAi) return;
    const text = String(this.data.draft || "").trim();
    if (!text) return;
    const item = {
      id: Date.now(),
      text,
      at: new Date().toISOString(),
      status: "pending",
    };
    const board = this.data.board
      .map(({ atLabel, ...rest }) => rest)
      .concat([item]);
    writeBoard(this.data.activeId, board);
    this.setData({ draft: "" });
    this.loadBoard();
  },

  localAiReply(q) {
    const zh = this.data.locale !== "en";
    return zh
      ? `涨球教练：关于「${q.slice(0, 36)}」——先把击球点再往身前送一个拍头。`
      : `Zhangqiu Coach: On “${q.slice(0, 36)}” — meet it farther in front.`;
  },

  onToggleLang() {
    const next = this.data.locale === "en" ? "zh-CN" : "en";
    setLang(next);
    this.setData({ locale: next });
    this.refreshPersonas();
    if (this.data.isAi) this.bootstrapAi();
    else this.loadBoard();
  },
});
