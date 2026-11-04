const i18n = require("../../utils/i18n")
const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

Page({
  data: {
    lang: "zh-CN",
    copy: i18n.pack("zh-CN"),
    loggedIn: false,
    code: "",
    error: "",
    errorCode: "",
    notice: "",
    noticeCode: "",
    loading: false,
  },
  onShow() {
    const lang = i18n.getLang()
    this.applyLang(lang)
    const auth = session.auth()
    this.setData({ loggedIn: !!auth })
    if (!auth) return
    api.me(auth.token).catch((err) => {
      if (err.code === "auth_invalid" || err.code === "auth_required") {
        session.clearAuth()
        this.errorCode = err && err.code ? err.code : "auth_invalid"
        this.setData({ loggedIn: false })
        this.applyLang(i18n.getLang())
      }
    })
  },
  applyLang(lang) {
    const copy = i18n.pack(lang)
    const errorCode = this.errorCode || ""
    const noticeCode = this.noticeCode || ""
    this.setData({
      lang,
      copy,
      error: errorCode ? errors.message(lang, { code: errorCode }) : "",
      notice: noticeCode ? i18n.lookup(lang, "home." + noticeCode) : "",
    })
    wx.setNavigationBarTitle({ title: copy.appTitle })
  },
  onSwitch(e) {
    this.applyLang(i18n.setLang(e.currentTarget.dataset.lang))
  },
  onCode(e) {
    this.setData({ code: e.detail.value })
  },
  onPrimary() {
    if (this.data.loading) return
    if (this.data.loggedIn && !String(this.data.code || "").trim()) {
      wx.navigateTo({ url: "/pages/guide/guide" })
      return
    }
    const typed = String(this.data.code || "").trim()
    this.errorCode = ""
    this.noticeCode = ""
    this.setData({ loading: true, error: "", notice: "" })
    const run = (code, noticeCode) => {
      api.mockLogin(code).then((body) => {
        if (!body || !body.token) {
          this.errorCode = "bad_response"
          this.setData({ loading: false })
          this.applyLang(this.data.lang)
          return
        }
        session.saveAuth(body)
        this.noticeCode = noticeCode || ""
        this.setData({ loading: false, loggedIn: true })
        this.applyLang(this.data.lang)
        wx.navigateTo({ url: "/pages/guide/guide" })
      }).catch((err) => {
        this.errorCode = err && err.code ? err.code : "generic"
        this.setData({ loading: false })
        this.applyLang(this.data.lang)
      })
    }
    if (typed) {
      run(typed, "")
      return
    }
    wx.login({
      success: (res) => {
        if (res.code) run(res.code, "")
        else run("dev-" + Date.now(), "localCode")
      },
      fail: () => run("dev-" + Date.now(), "localCode"),
    })
  },
})
