const i18n = require("../../utils/i18n")
const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

Page({
  data: {
    lang: "zh-CN",
    copy: i18n.pack("zh-CN"),
    loggedIn: false,
    phone: "",
    code: "",
    devCode: "",
    error: "",
    errorCode: "",
    notice: "",
    noticeCode: "",
    loading: false,
    sending: false,
  },
  onShow() {
    const lang = i18n.getLang()
    this.applyLang(lang)
    const auth = session.auth()
    this.setData({ loggedIn: !!auth })
  },
  applyLang(lang) {
    const copy = i18n.pack(lang)
    const errorCode = this.errorCode || ""
    const noticeCode = this.noticeCode || ""
    this.setData({
      lang,
      copy,
      error: errorCode ? errors.message(lang, { code: errorCode, detail: this.errorDetail }) : "",
      notice: noticeCode ? i18n.lookup(lang, "home." + noticeCode) : "",
    })
    wx.setNavigationBarTitle({ title: copy.appTitle })
  },
  onSwitch(e) {
    this.applyLang(i18n.setLang(e.currentTarget.dataset.lang))
  },
  onPhone(e) {
    this.setData({ phone: e.detail.value, devCode: "" })
  },
  onCode(e) {
    this.setData({ code: e.detail.value })
  },
  onSendCode() {
    if (this.data.sending || this.data.loading) return
    const phone = String(this.data.phone || "").trim()
    if (!/^1\d{10}$/.test(phone)) {
      this.errorCode = "phone_invalid"
      this.errorDetail = ""
      this.applyLang(this.data.lang)
      return
    }
    this.errorCode = ""
    this.setData({ sending: true, error: "", devCode: "" })
    api.requestCode(phone).then((body) => {
      const shown = body && body.code ? String(body.code) : ""
      this.noticeCode = shown ? "codeShown" : "codeSent"
      this.setData({
        sending: false,
        devCode: shown,
        code: shown || this.data.code,
      })
      this.applyLang(this.data.lang)
    }).catch((err) => {
      this.errorCode = err && err.code ? err.code : "generic"
      this.errorDetail = err && err.detail ? err.detail : ""
      this.setData({ sending: false })
      this.applyLang(this.data.lang)
    })
  },
  onPrimary() {
    if (this.data.loading) return
    if (this.data.loggedIn) {
      wx.navigateTo({ url: "/pages/guide/guide" })
      return
    }
    const phone = String(this.data.phone || "").trim()
    const code = String(this.data.code || "").trim()
    if (!/^1\d{10}$/.test(phone)) {
      this.errorCode = "phone_invalid"
      this.applyLang(this.data.lang)
      return
    }
    if (!code) {
      this.errorCode = "code_required"
      this.applyLang(this.data.lang)
      return
    }
    this.errorCode = ""
    this.noticeCode = ""
    this.setData({ loading: true, error: "", notice: "" })
    api.phoneLogin(phone, code).then((body) => {
      if (!body || !body.token) {
        this.errorCode = "bad_response"
        this.setData({ loading: false })
        this.applyLang(this.data.lang)
        return
      }
      session.saveAuth(body)
      this.setData({ loading: false, loggedIn: true, code: "", devCode: "" })
      this.applyLang(this.data.lang)
      wx.navigateTo({ url: "/pages/guide/guide" })
    }).catch((err) => {
      this.errorCode = err && err.code ? err.code : "generic"
      this.errorDetail = err && err.detail ? err.detail : ""
      this.setData({ loading: false })
      this.applyLang(this.data.lang)
    })
  },
})
