const config = require("../../config")
const session = require("../../utils/session")

function apiBase() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function buildUrl(token, nextPath) {
  const base = apiBase()
  const next = nextPath && String(nextPath).startsWith("/") ? String(nextPath) : "/"
  if (token) {
    return (
      base +
      "/api/auth/mp-enter?token=" +
      encodeURIComponent(token) +
      "&next=" +
      encodeURIComponent(next)
    )
  }
  return base + "/login"
}

Page({
  data: {
    url: "",
  },
  onLoad(query) {
    const auth = session.auth()
    const token = (query && query.token) || (auth && auth.token) || ""
    const next = (query && query.next) || "/"
    if (!token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    this.setData({ url: buildUrl(token, next) })
  },
  onShow() {
    // If storage was cleared (logout from web), bounce back to native login.
    const auth = session.auth()
    if (!auth || !auth.token) {
      if (this.data.url) {
        wx.redirectTo({ url: "/pages/login/login" })
      }
    }
  },
  onMessage(e) {
    // web-view → native: logout | subscribe (H5 更推荐 wx.miniProgram.navigateTo 订阅页)
    const rows = (e && e.detail && e.detail.data) || []
    const last = rows.length ? rows[rows.length - 1] : null
    if (!last || !last.type) return
    if (last.type === "logout") {
      session.clearAuth()
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    if (last.type === "subscribe") {
      const events = Array.isArray(last.events) ? last.events.join(",") : String(last.events || "")
      const next = last.next || "/"
      wx.navigateTo({
        url:
          "/pages/subscribe/subscribe?events=" +
          encodeURIComponent(events) +
          "&next=" +
          encodeURIComponent(next),
      })
    }
  },
})
