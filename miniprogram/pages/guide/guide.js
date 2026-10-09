const i18n = require("../../utils/i18n")
const session = require("../../utils/session")
const guide = require("../../utils/guide")

Page({
  data: {
    lang: "zh-CN",
    copy: i18n.pack("zh-CN"),
    items: [],
    checks: { side: false, full_body: false, racket: false },
    progress: "",
  },
  onShow() {
    if (!session.auth()) {
      wx.redirectTo({ url: "/pages/home/home" })
      return
    }
    const checks = session.guide()
    this.paint(i18n.getLang(), checks)
  },
  paint(lang, checks) {
    const copy = i18n.pack(lang)
    this.setData({
      lang,
      copy,
      checks,
      items: guide.items(copy, checks),
      progress: i18n.format(lang, "guide.progress", { done: guide.count(checks), total: guide.KEYS.length }),
    })
    wx.setNavigationBarTitle({ title: copy.appTitle })
  },
  onSwitch(e) {
    const lang = i18n.setLang(e.currentTarget.dataset.lang)
    this.paint(lang, this.data.checks)
  },
  onToggle(e) {
    const key = e.currentTarget.dataset.key
    if (guide.KEYS.indexOf(key) < 0) return
    const checks = Object.assign({}, this.data.checks)
    checks[key] = !checks[key]
    session.saveGuide(checks)
    this.paint(this.data.lang, checks)
  },
  onNext() {
    session.saveGuide(this.data.checks)
    wx.navigateTo({ url: "/pages/upload/upload" })
  },
})
