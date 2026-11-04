const api = require("../../utils/api")
const session = require("../../utils/session")

Page({
  data: {
    tab: "improve",
    draft: "",
    pending: false,
    error: "",
    messages: [],
    history: [],
    anchor: "",
  },
  _seq: 0,
  onShow() {
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    if (!this.data.messages.length && !this.data.pending) {
      this.ask([], { daily: true, improve: false })
    }
  },
  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab || "improve" })
  },
  onLibrary() {
    wx.navigateTo({ url: "/pages/coach-library/coach-library" })
  },
  onDraft(e) {
    this.setData({ draft: e.detail.value || "" })
  },
  onQuick(e) {
    const q = e.currentTarget.dataset.q || ""
    if (!q) return
    this.sendText(q)
  },
  onSend() {
    this.sendText(this.data.draft)
  },
  nextId(prefix) {
    this._seq += 1
    return prefix + "-" + this._seq
  },
  sendText(raw) {
    const text = String(raw || "").trim()
    if (!text || this.data.pending) return
    const userMsg = { id: this.nextId("u"), role: "user", text }
    const history = this.data.history.concat([{ role: "user", content: text }])
    this.setData({
      draft: "",
      messages: this.data.messages.concat([userMsg]),
      history,
      tab: "chat",
      anchor: "m-" + userMsg.id,
    })
    this.ask(history, { daily: false, improve: true })
  },
  ask(history, flags) {
    const auth = session.auth()
    if (!auth || !auth.token) return
    this.setData({ pending: true, error: "" })
    api
      .coachChat(auth.token, {
        messages: history,
        confirmedDaily: !!(flags && flags.daily),
        confirmedImprove: !!(flags && flags.improve),
        coachId: "zhangqiu",
        locale: "zh",
      })
      .then((payload) => {
        const text = (payload && payload.text) || ""
        if (!text) {
          this.setData({ pending: false, error: "教练暂时没有回复，请重试" })
          return
        }
        const msg = { id: this.nextId("c"), role: "coach", text }
        this.setData({
          pending: false,
          messages: this.data.messages.concat([msg]),
          history: history.concat([{ role: "assistant", content: text }]),
          anchor: "m-" + msg.id,
        })
      })
      .catch((err) => {
        this.setData({
          pending: false,
          error: (err && (err.detail || err.message)) || "网络错误，请重试",
        })
      })
  },
})
