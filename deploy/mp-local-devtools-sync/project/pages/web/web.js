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
  // ZQ-168: guest browse — public H5 paths only (no session).
  return base + next
}

Page({
  data: {
    url: "",
    guest: false,
  },
  onLoad(query) {
    const guest = String((query && query.guest) || "") === "1"
    const auth = session.auth()
    const token = (query && query.token) || (auth && auth.token) || ""
    const next = (query && query.next) || (guest ? "/guest" : "/")
    if (!token && !guest) {
      wx.redirectTo({ url: "/pages/home/home" })
      return
    }
    this.setData({
      guest: guest && !token,
      url: buildUrl(guest && !token ? "" : token, next),
    })
  },
  onShow() {
    if (this.data.guest) return
    const auth = session.auth()
    if (!auth || !auth.token) {
      if (this.data.url) {
        wx.redirectTo({ url: "/pages/home/home" })
      }
    }
  },
  onMessage(e) {
    const rows = (e && e.detail && e.detail.data) || []
    const last = rows.length ? rows[rows.length - 1] : null
    if (!last || !last.type) return
    if (last.type === "logout") {
      session.clearAuth()
      wx.redirectTo({ url: "/pages/home/home" })
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
