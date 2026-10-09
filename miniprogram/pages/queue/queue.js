const i18n = require("../../utils/i18n")
const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")

Page({
  data: {
    lang: "zh-CN",
    copy: i18n.pack("zh-CN"),
    jobId: "",
    jobLine: "",
    status: "unknown",
    statusLabel: i18n.lookup("zh-CN", "queue.unknown"),
    guideFlag: null,
    serverMessage: "",
    error: "",
    terminal: false,
  },
  onLoad(options) {
    this.jobId = (options && options.job_id) || ""
  },
  onShow() {
    const lang = i18n.getLang()
    if (!this.jobId) {
      this.paint(lang, {
        jobId: "",
        errorCode: "bad_response",
        terminal: true,
      })
      return
    }
    this.paint(lang, { jobId: this.jobId })
    this.poll()
  },
  onHide() {
    clearTimeout(this._timer)
  },
  onUnload() {
    clearTimeout(this._timer)
  },
  paint(lang, extra) {
    const copy = i18n.pack(lang)
    const patch = extra || {}
    const status = patch.status || this.data.status || "unknown"
    const jobId = Object.prototype.hasOwnProperty.call(patch, "jobId") ? patch.jobId : (this.jobId || "")
    if (Object.prototype.hasOwnProperty.call(patch, "errorCode")) this.errorCode = patch.errorCode || ""
    this.setData(Object.assign({}, patch, {
      lang,
      copy,
      status,
      jobId,
      statusLabel: i18n.lookup(lang, "queue." + status) || copy.queue.unknown,
      jobLine: i18n.format(lang, "queue.jobId", { id: jobId || "—" }),
      error: this.errorCode ? errors.message(lang, { code: this.errorCode }) : "",
    }))
    wx.setNavigationBarTitle({ title: copy.appTitle })
  },
  onSwitch(e) {
    this.paint(i18n.setLang(e.currentTarget.dataset.lang))
  },
  poll() {
    clearTimeout(this._timer)
    const auth = session.auth()
    api.job(this.jobId, auth && auth.token).then((job) => {
      if (!job || !job.id) {
        this.paint(i18n.getLang(), { errorCode: "bad_response" })
        this._timer = setTimeout(() => this.poll(), 3000)
        return
      }
      const status = job.status || "unknown"
      const meta = job.metadata || {}
      const terminal = status === "done" || status === "error" || status === "cancelled"
      const guideFlag = typeof meta.guide_completed === "boolean" ? meta.guide_completed : null
      this.paint(i18n.getLang(), {
        status,
        guideFlag,
        serverMessage: (status === "error" || status === "cancelled") ? (job.message || "") : "",
        errorCode: "",
        terminal,
      })
      if (terminal) return
      this._timer = setTimeout(() => this.poll(), 2000)
    }).catch((err) => {
      this.paint(i18n.getLang(), { errorCode: (err && err.code) || "generic" })
      this._timer = setTimeout(() => this.poll(), 3000)
    })
  },
  onHome() {
    wx.reLaunch({ url: "/pages/home/home" })
  },
  onRetry() {
    wx.navigateBack({ delta: 1 })
  },
})
