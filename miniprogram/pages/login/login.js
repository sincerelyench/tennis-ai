const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

function enterApp(token) {
  wx.redirectTo({
    url: "/pages/web/web?token=" + encodeURIComponent(token),
  })
}

function enterProfileSetup() {
  wx.redirectTo({
    url: "/pages/profile-setup/profile-setup",
  })
}

/** User-facing login error — never show opaque codes like "server". */
function loginErrorText(err, fallback) {
  const localized = errors.message("zh-CN", err)
  if (localized) return localized
  const detail = err && typeof err.detail === "string" ? err.detail.trim() : ""
  if (detail && !/^(server|network|generic|auth_invalid)$/i.test(detail)) {
    return detail
  }
  return fallback || "登录失败，请重试"
}

Page({
  data: {
    mode: "wechat",
    username: "",
    password: "",
    phone: "",
    smsCode: "",
    devCode: "",
    loading: false,
    codeLoading: false,
    error: "",
    notice: "",
  },
  onShow() {
    // Drop sticky errors from a previous failed attempt (e.g. raw "server" from 5xx).
    this.setData({ error: "" })
    const auth = session.auth()
    if (!auth || !auth.token) return
    // Validate before skipping native login; stale/mock tokens otherwise land in
    // web-view /login (no 微信登录) and look like WeChat login is missing.
    api
      .session(auth.token)
      .then((body) => {
        if (body && body.needsProfileSetup) {
          enterProfileSetup()
          return
        }
        enterApp(auth.token)
      })
      .catch(() => {
        session.clearAuth()
        this.setData({
          mode: "wechat",
          notice: "登录已过期，请用微信登录或账号重新登录",
        })
      })
  },
  onMode(e) {
    const mode = (e.currentTarget.dataset && e.currentTarget.dataset.mode) || "wechat"
    this.setData({ mode, error: "", notice: "" })
  },
  onUsername(e) {
    this.setData({ username: e.detail.value || "" })
  },
  onPassword(e) {
    this.setData({ password: e.detail.value || "" })
  },
  onPhone(e) {
    this.setData({ phone: e.detail.value || "" })
  },
  onSmsCode(e) {
    this.setData({ smsCode: e.detail.value || "" })
  },
  /**
   * After auth: incomplete 约球 profile → native profile-setup (nick picker + 微信号).
   * Complete → web-view. ZQ-158: displayName / nick never collected on WeChat login tab.
   */
  finishLogin(body, notice) {
    if (!body || !body.token) {
      this.setData({ loading: false, error: "登录失败，请重试" })
      return
    }
    session.saveAuth(body)
    this.setData({ loading: false, error: "", notice: "" })
    if (notice) {
      wx.showToast({ title: notice, icon: "none", duration: 2500 })
    }
    if (body.needsProfileSetup) {
      enterProfileSetup()
      return
    }
    enterApp(body.token)
  },
  /** ZQ-158: one tap — wx.login → /api/auth/wechat; no displayName / nickName on this page. */
  onWechatLogin() {
    if (this.data.loading) return
    this.setData({ loading: true, error: "", notice: "" })
    const finish = (code) => {
      api
        .wechatLogin({ code })
        .then((body) => {
          if (!body || !body.token) {
            this.setData({ loading: false, error: "登录失败，请重试" })
            return
          }
          const notice =
            body.loginMode === "wechat-mock"
              ? "已进入演示会话（服务端 AppID 未与本小程序对齐时）"
              : ""
          this.finishLogin(body, notice)
        })
        .catch((err) => {
          this.setData({
            loading: false,
            error: loginErrorText(err, "登录失败，请重试"),
          })
        })
    }
    wx.login({
      success: (res) => {
        if (res.code) finish(res.code)
        else finish("dev-" + Date.now())
      },
      fail: () => finish("dev-" + Date.now()),
    })
  },
  onPasswordLogin() {
    if (this.data.loading) return
    const username = String(this.data.username || "").trim()
    const password = String(this.data.password || "")
    if (!username || password.length < 4) {
      this.setData({ error: "请填写用户名（或手机号）和密码" })
      return
    }
    this.setData({ loading: true, error: "", notice: "" })
    api
      .accountLogin({ username, password })
      .then((body) => this.finishLogin(body))
      .catch((err) => {
        this.setData({
          loading: false,
          error: loginErrorText(err, "登录失败，请重试"),
        })
      })
  },
  onSendCode() {
    if (this.data.codeLoading) return
    const phone = String(this.data.phone || "").trim()
    if (!/^\d{11}$/.test(phone)) {
      this.setData({ error: "请输入 11 位手机号" })
      return
    }
    this.setData({ codeLoading: true, error: "", notice: "", devCode: "" })
    api
      .sendPhoneCode({ phone })
      .then((body) => {
        this.setData({
          codeLoading: false,
          notice: "验证码已发送（开发环境可能直接显示在下方）",
          devCode: (body && body.code) || "",
          smsCode: (body && body.code) || this.data.smsCode,
        })
      })
      .catch((err) => {
        this.setData({
          codeLoading: false,
          error: loginErrorText(err, "发送失败"),
        })
      })
  },
  onPhoneLogin() {
    if (this.data.loading) return
    const phone = String(this.data.phone || "").trim()
    const code = String(this.data.smsCode || "").trim()
    if (!/^\d{11}$/.test(phone) || !code) {
      this.setData({ error: "请填写手机号和验证码" })
      return
    }
    this.setData({ loading: true, error: "", notice: "" })
    api
      .accountLogin({ phone, code })
      .then((body) => this.finishLogin(body))
      .catch((err) => {
        this.setData({
          loading: false,
          error: loginErrorText(err, "登录失败，请重试"),
        })
      })
  },
})
