const session = require("../../utils/session")
const subscribe = require("../../utils/subscribe")

function enterWeb(nextPath) {
  const auth = session.auth()
  if (!auth || !auth.token) {
    wx.redirectTo({ url: "/pages/login/login" })
    return
  }
  const next = nextPath && String(nextPath).startsWith("/") ? String(nextPath) : "/"
  wx.redirectTo({
    url:
      "/pages/web/web?token=" +
      encodeURIComponent(auth.token) +
      "&next=" +
      encodeURIComponent(next),
  })
}

Page({
  data: {
    status: "准备订阅…",
    detail: "",
    done: false,
  },
  onLoad(query) {
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    const raw = (query && query.events) || ""
    const events = String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const next = (query && query.next) || "/notices"
    this._next = next
    this._events = events.length ? events : subscribe.EVENTS.slice()
    this.setData({
      status: "请确认微信订阅弹窗",
      detail: "用于约战、应战、比分确认、留言与排行变动提醒（站内通知仍保留）。",
    })
  },
  onEnable() {
    if (this.data.done) {
      enterWeb(this._next)
      return
    }
    this.setData({ status: "正在请求订阅…" })
    subscribe
      .requestSubscribe(this._events)
      .then((res) => {
        if (res && res.skipped) {
          this.setData({
            status: "模板尚未配置",
            detail:
              "请在微信公众平台创建订阅消息模板，并设置 WECHAT_MP_TMPL_* 或 config.subscribeTemplates。",
            done: true,
          })
          return
        }
        if (res && res.ok) {
          this.setData({
            status: "订阅完成",
            detail: "可返回继续使用。若未勾选某类消息，该类将不会推送到微信。",
            done: true,
          })
          setTimeout(() => enterWeb(this._next), 600)
          return
        }
        this.setData({
          status: "订阅未完成",
          detail: (res && res.error) || "可稍后在通知中心再次开启",
          done: true,
        })
      })
      .catch((err) => {
        this.setData({
          status: "订阅失败",
          detail: (err && err.message) || "请重试",
          done: true,
        })
      })
  },
  onSkip() {
    enterWeb(this._next || "/")
  },
})
