const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

const INTRO_STORAGE_KEY = "zq_mp_onboarded_v1"

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
    // ZQ-172: only signup / signin (password). No WeChat, phone, or role.
    authTab: "signup",
    username: "",
    password: "",
    password2: "",
    loading: false,
    error: "",
    notice: "",
    agreedLegal: false,
  },
  onLoad() {
    if (!readIntroSeen()) writeIntroSeen()
  },
  onShow() {
    this.setData({ error: "" })
    const auth = session.auth()
    if (!auth || !auth.token) return
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
          notice: "登录已过期，请用账号密码重新登录",
        })
      })
  },
  onBackHome() {
    wx.redirectTo({
      url: "/pages/web/web?guest=1&next=/ladder",
      fail: () => wx.reLaunch({ url: "/pages/home/home" }),
    })
  },
  onOpenTerms() {
    wx.navigateTo({ url: "/pages/legal/legal?kind=terms" })
  },
  onOpenPrivacy() {
    wx.navigateTo({ url: "/pages/legal/legal?kind=privacy" })
  },
  onConsentChange(e) {
    const vals = (e.detail && e.detail.value) || []
    this.setData({ agreedLegal: vals.indexOf("agree") >= 0, error: "" })
  },
  requireConsent() {
    if (this.data.agreedLegal) return true
    this.setData({
      error: "请先阅读并勾选同意《用户服务协议》和《隐私政策》",
    })
    return false
  },
  onAuthTab(e) {
    const tab = (e.currentTarget.dataset && e.currentTarget.dataset.tab) || "signup"
    this.setData({
      authTab: tab === "signin" ? "signin" : "signup",
      error: "",
      notice: "",
    })
  },
  onUsername(e) {
    this.setData({ username: e.detail.value || "" })
  },
  onPassword(e) {
    this.setData({ password: e.detail.value || "" })
  },
  onPassword2(e) {
    this.setData({ password2: e.detail.value || "" })
  },
  finishLogin(body) {
    if (!body || !body.token) {
      this.setData({ loading: false, error: "登录失败，请重试" })
      return
    }
    session.saveAuth(body)
    this.setData({ loading: false, error: "", notice: "" })
    if (body.needsProfileSetup) {
      enterProfileSetup()
      return
    }
    enterApp(body.token)
  },
  onPasswordLogin() {
    if (this.data.loading) return
    // ZQ-175: consent checkbox only on 注册, not 登录
    const username = String(this.data.username || "").trim()
    const password = String(this.data.password || "")
    if (!username || password.length < 4) {
      this.setData({ error: "请填写用户名和密码" })
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
  onRegister() {
    if (this.data.loading) return
    if (!this.requireConsent()) return
    const username = String(this.data.username || "").trim()
    const password = String(this.data.password || "")
    const password2 = String(this.data.password2 || "")
    if (!/^[a-zA-Z0-9_\-]{3,32}$/.test(username)) {
      this.setData({ error: "用户名需 3–32 位字母、数字、_ 或 -" })
      return
    }
    if (password.length < 4) {
      this.setData({ error: "密码至少 4 位" })
      return
    }
    if (password !== password2) {
      this.setData({ error: "两次密码不一致" })
      return
    }
    this.setData({ loading: true, error: "", notice: "" })
    // ZQ-172: no role UI — always register as player.
    api
      .accountRegister({ username, password, role: "player" })
      .then((body) => this.finishLogin(body))
      .catch((err) => {
        this.setData({
          loading: false,
          error: loginErrorText(err, "注册失败，请重试"),
        })
      })
  },
})
