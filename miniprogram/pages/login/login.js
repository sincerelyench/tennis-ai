const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

function enterApp(token) {
  wx.redirectTo({
    url: "/pages/web/web?token=" + encodeURIComponent(token),
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
    nickName: "",
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
    const auth = session.auth()
    if (!auth || !auth.token) return
    // Validate before skipping native login; stale/mock tokens otherwise land in
    // web-view /login (no 微信登录) and look like WeChat login is missing.
    api
      .session(auth.token)
      .then(() => enterApp(auth.token))
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
  /**
   * Write selected / typed WeChat nick into the display-name field (page data nickName).
   * Only update when detail.value is a string — nicknamereview has no value.
   */
  applyNickValue(raw) {
    if (typeof raw !== "string") return
    const nickName = raw.trim().slice(0, 40)
    if (nickName === this.data.nickName) return
    this.setData({ nickName })
  },
  onNickInput(e) {
    const detail = (e && e.detail) || {}
    this.applyNickValue(detail.value)
  },
  onNickBlur(e) {
    const detail = (e && e.detail) || {}
    // Native nickname picker often commits on blur; keep displayName in sync.
    this.applyNickValue(detail.value)
  },
  onNickReview(e) {
    // WeChat fires { pass, timeout } only — never clear nickName here (ZQ-154).
    const detail = (e && e.detail) || {}
    if (detail.pass === false) {
      this.setData({
        notice: "微信名未通过内容审核，请改一个显示名或手动填写",
      })
      return
    }
    // pass/timeout: value already applied via input/blur; keep existing nickName.
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
  finishLogin(body, notice) {
    if (!body || !body.token) {
      this.setData({ loading: false, error: "登录失败，请重试" })
      return
    }
    session.saveAuth(body)
    // Do not leave a sticky "error-looking" banner on the login page after success.
    // Mock / AppID-mismatch sessions still get a short toast, then enter the app.
    this.setData({ loading: false, error: "", notice: "" })
    if (notice) {
      wx.showToast({ title: notice, icon: "none", duration: 2500 })
    }
    enterApp(body.token)
  },
  onWechatLogin() {
    if (this.data.loading) return
    this.setData({ loading: true, error: "", notice: "" })
    const nickName = String(this.data.nickName || "").trim()
    const finish = (code) => {
      api
        .wechatLogin({ code, nickName })
        .then((body) => {
          if (!body || !body.token) {
            this.setData({ loading: false, error: "登录失败，请重试" })
            return null
          }
          session.saveAuth(body)
          if (body.displayName) return body
          if (!nickName) return body
          return api
            .updateProfile(body.token, { displayName: nickName })
            .then((profile) => {
              session.patchAuth({
                displayName: (profile && profile.displayName) || nickName,
              })
              return body
            })
            .catch(() => body)
        })
        .then((body) => {
          if (!body) return
          // Prod WECHAT_MP_APPID must match project.config.json appid, otherwise
          // jscode2session falls back to wechat-mock (looks like a post-login error).
          const notice =
            body.loginMode === "wechat-mock"
              ? "已进入演示会话（服务端 AppID 未与本小程序对齐时）"
              : ""
          // Enter web-view immediately. Subscribe (ZQ-150) stays optional via
          // pages/subscribe — do not block login success with template errors.
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
          error: loginErrorText(err, "发送失败，请重试"),
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
