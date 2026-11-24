const config = require("../../config")
const session = require("../../utils/session")

function apiBase() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function buildUrl(token, nextPath) {
  const base = apiBase()
  const next = nextPath && String(nextPath).startsWith("/") ? String(nextPath) : "/ladder"
  if (token) {
    return (
      base +
      "/api/auth/mp-enter?token=" +
      encodeURIComponent(token) +
      "&next=" +
      encodeURIComponent(next)
    )
  }
  // ZQ-175: guest — public H5 paths (/ladder, /coach); gated tabs redirect to login in H5.
  return base + next
}

function openGuestLadder() {
  wx.redirectTo({ url: "/pages/web/web?guest=1&next=/ladder" })
}

function openNativeLogin(nextPath) {
  const next = nextPath && String(nextPath).startsWith("/") ? String(nextPath) : "/friends"
  wx.redirectTo({
    url: "/pages/login/login?next=" + encodeURIComponent(next),
  })
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
    const next = (query && query.next) || (guest ? "/ladder" : "/ladder")
    if (!token && !guest) {
      openGuestLadder()
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
        openGuestLadder()
      }
    }
  },
  onMessage(e) {
    const rows = (e && e.detail && e.detail.data) || []
    const last = rows.length ? rows[rows.length - 1] : null
    if (!last || !last.type) return
    if (last.type === "logout") {
      session.clearAuth()
      openGuestLadder()
      return
    }
    if (last.type === "needLogin") {
      openNativeLogin(last.next || "/friends")
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
