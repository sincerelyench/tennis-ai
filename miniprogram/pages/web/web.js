const config = require("../../config")
const session = require("../../utils/session")

function apiBase() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function buildUrl(token, nextPath, onboarded) {
  const base = apiBase()
  let next = nextPath && String(nextPath).startsWith("/") ? String(nextPath) : "/"
  // ZQ-159: if native login already showed the product intro, tell web Onboarding to skip.
  if (onboarded) {
    next += (next.indexOf("?") >= 0 ? "&" : "?") + "zq_onboarded=1"
  }
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
    const onboarded =
      (query && (query.onboarded === "1" || query.onboarded === 1)) ||
      (() => {
        try {
          return wx.getStorageSync("tennis-onboarded") === "1"
        } catch (e) {
          return false
        }
      })()
    if (!token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    this.setData({ url: buildUrl(token, next, onboarded) })
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
    // Optional: web can postMessage({ type: 'logout' }) via wx.miniProgram.postMessage
    const rows = (e && e.detail && e.detail.data) || []
    const last = rows.length ? rows[rows.length - 1] : null
    if (last && last.type === "logout") {
      session.clearAuth()
      wx.redirectTo({ url: "/pages/login/login" })
    }
  },
})
