const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

function enterApp(token) {
  wx.redirectTo({
    url: "/pages/web/web?token=" + encodeURIComponent(token),
  })
}

function errorText(err, fallback) {
  const localized = errors.message("zh-CN", err)
  if (localized) return localized
  const detail = err && typeof err.detail === "string" ? err.detail.trim() : ""
  if (detail && !/^(server|network|generic|auth_invalid)$/i.test(detail)) {
    return detail
  }
  return fallback || "保存失败，请重试"
}

Page({
  data: {
    displayName: "",
    wechatId: "",
    loading: false,
    error: "",
    notice: "",
  },
  onShow() {
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    this.setData({
      displayName: auth.displayName || "",
      // ZQ-157: never seed openid into 微信号; leave empty for user fill.
      wechatId: auth.wechatId || "",
      error: "",
    })
  },
  /**
   * Write selected / typed WeChat nick into displayName.
   * Only update when detail.value is a string — nicknamereview has no value (ZQ-154).
   */
  applyNickValue(raw) {
    if (typeof raw !== "string") return
    const displayName = raw.trim().slice(0, 40)
    if (displayName === this.data.displayName) return
    this.setData({ displayName })
  },
  onNickInput(e) {
    const detail = (e && e.detail) || {}
    this.applyNickValue(detail.value)
  },
  onNickBlur(e) {
    const detail = (e && e.detail) || {}
    this.applyNickValue(detail.value)
  },
  onNickReview(e) {
    const detail = (e && e.detail) || {}
    if (detail.pass === false) {
      this.setData({
        notice: "微信名未通过内容审核，请改一个显示名或手动填写",
      })
    }
  },
  onWechatId(e) {
    this.setData({ wechatId: (e.detail.value || "").trim() })
  },
  onSave() {
    if (this.data.loading) return
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    const displayName = String(this.data.displayName || "").trim()
    const wechatId = String(this.data.wechatId || "").trim()
    if (!displayName) {
      this.setData({ error: "请填写显示名（可选入微信名）" })
      return
    }
    if (!wechatId) {
      this.setData({ error: "请填写真实微信号（约球用；不是 openid）" })
      return
    }
    // Guard: refuse obvious openid-shaped paste if it matches stored openid.
    if (auth.openid && wechatId === String(auth.openid).trim()) {
      this.setData({ error: "请填写真实微信号，不要填 openid" })
      return
    }
    this.setData({ loading: true, error: "", notice: "" })
    api
      .updateProfile(auth.token, { displayName, wechatId })
      .then((profile) => {
        session.patchAuth({
          displayName: (profile && profile.displayName) || displayName,
          wechatId: (profile && profile.wechatId) || wechatId,
        })
        this.setData({ loading: false })
        enterApp(auth.token)
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: errorText(err, "保存失败，请重试"),
        })
      })
  },
})
