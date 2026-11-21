const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

const INTRO_STORAGE_KEY = "zq_mp_onboarded_v1"

/** Webpage 四卖点（约球/多打球）— not 动作/视频分析 (ZQ-159). */
const INTRO_POINTS = [
  {
    title: "一起涨球乐",
    desc: "多打球、多比赛，在实战中打磨技术，大家一起涨球乐。",
  },
  {
    title: "约到水平相当的球友",
    desc: "轻松找到本地水平相当（或上下）的球友来挑战。",
  },
  {
    title: "赛后看排名变化",
    desc: "排名不随意，按与对手水平相近程度计算，打完就能看到升降。",
  },
  {
    title: "AI 教练与真实网络教练",
    desc: "日常训练有疑问或拍下动作，可获 AI 教练与真实网络教练指导。",
  },
]

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

function readIntroSeen() {
  try {
    return !!wx.getStorageSync(INTRO_STORAGE_KEY)
  } catch (e) {
    return false
  }
}

function writeIntroSeen() {
  try {
    wx.setStorageSync(INTRO_STORAGE_KEY, 1)
  } catch (e) {
    /* ignore */
  }
}

Page({
  data: {
    // ZQ-166: temporarily hide WeChat login on MP. Flip to true to restore.
    enableWechatLogin: false,
    mode: "password",
    username: "",
    password: "",
    phone: "",
    smsCode: "",
    devCode: "",
    loading: false,
    codeLoading: false,
    error: "",
    notice: "",
    showIntro: false,
    introPoints: INTRO_POINTS,
  },
  onLoad() {
    this.setData({ showIntro: !readIntroSeen() })
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
          mode: "password",
          // ZQ-166: do not push users toward WeChat while it is temporarily hidden.
          notice: "登录已过期，请用账号密码或手机验证码重新登录",
        })
      })
  },
  noop() {},
  onIntroDismiss() {
    writeIntroSeen()
    this.setData({ showIntro: false })
  },
  onMode(e) {
    let mode =
      (e.currentTarget.dataset && e.currentTarget.dataset.mode) || "password"
    // ZQ-166: refuse wechat mode while enableWechatLogin is false.
    if (mode === "wechat" && !this.data.enableWechatLogin) mode = "password"
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
    // ZQ-166: keep handler for easy restore; no-op while hidden.
    if (!this.data.enableWechatLogin) return
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
