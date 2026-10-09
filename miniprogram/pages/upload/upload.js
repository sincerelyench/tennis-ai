const i18n = require("../../utils/i18n")
const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")
const guide = require("../../utils/guide")

const MAX_BYTES = 400 * 1024 * 1024
const MIN_BYTES = 1000

function sizeLabel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB"
  return (n / (1024 * 1024)).toFixed(1) + " MB"
}

Page({
  data: {
    lang: "zh-CN",
    copy: i18n.pack("zh-CN"),
    stroke: "forehand",
    chosen: "",
    longClip: false,
    guideDone: false,
    error: "",
    errorCode: "",
    loading: false,
  },
  onShow() {
    if (!session.auth()) {
      wx.redirectTo({ url: "/pages/home/home" })
      return
    }
    this.paint(i18n.getLang())
  },
  paint(lang) {
    const copy = i18n.pack(lang)
    const checks = session.guide()
    const video = session.video()
    const chosen = video && video.path
      ? i18n.format(lang, "upload.chosen", { name: video.name || "video", size: sizeLabel(video.size) })
      : copy.upload.none
    const errorCode = this.errorCode || ""
    this.setData({
      lang,
      copy,
      guideDone: guide.completed(checks),
      chosen,
      longClip: !!(video && Number(video.duration) > 20),
      error: errorCode ? errors.message(lang, { code: errorCode }) : "",
    })
    wx.setNavigationBarTitle({ title: copy.appTitle })
  },
  onSwitch(e) {
    this.paint(i18n.setLang(e.currentTarget.dataset.lang))
  },
  showError(code) {
    this.errorCode = code || ""
    this.setData({
      error: this.errorCode ? errors.message(this.data.lang, { code: this.errorCode }) : "",
    })
  },
  onStroke(e) {
    const stroke = e.currentTarget.dataset.stroke === "backhand" ? "backhand" : "forehand"
    this.setData({ stroke })
  },
  onChoose(e) {
    const source = e.currentTarget.dataset.source === "camera" ? "camera" : "album"
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: [source],
      maxDuration: 60,
      camera: "back",
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) {
          this.showError("video_required")
          return
        }
        const size = Number(file.size || 0)
        const name = String(file.tempFilePath).split("/").pop()
        if (size > MAX_BYTES) {
          this.showError("video_too_large")
          return
        }
        if (size && size < MIN_BYTES) {
          this.showError("video_too_small")
          return
        }
        if (!/\.(mp4|mov|webm|m4v|avi)$/i.test(name || "")) {
          this.showError("video_type")
          return
        }
        session.saveVideo({
          path: file.tempFilePath,
          size,
          duration: Number(file.duration || 0),
          name,
        })
        this.showError("")
        this.paint(this.data.lang)
      },
      fail: (err) => {
        const msg = err && err.errMsg ? String(err.errMsg) : ""
        if (msg.indexOf("cancel") >= 0) return
        this.showError("generic")
      },
    })
  },
  onSubmit() {
    if (this.data.loading) return
    const auth = session.auth()
    if (!auth) {
      this.showError("auth_required")
      return
    }
    const video = session.video()
    if (!video || !video.path) {
      this.showError("video_required")
      return
    }
    if (video.size > MAX_BYTES) {
      this.showError("video_too_large")
      return
    }
    if (video.size && video.size < MIN_BYTES) {
      this.showError("video_too_small")
      return
    }
    const checks = session.guide()
    this.showError("")
    this.setData({ loading: true })
    api.uploadVideo({
      filePath: video.path,
      token: auth.token,
      stroke: this.data.stroke,
      guideCompleted: guide.completed(checks),
      guideChecks: checks,
    }).then((body) => {
      this.setData({ loading: false })
      if (!body || !body.job_id) {
        this.showError("bad_response")
        return
      }
      wx.navigateTo({ url: "/pages/queue/queue?job_id=" + encodeURIComponent(body.job_id) })
    }).catch((err) => {
      this.setData({ loading: false })
      this.showError((err && err.code) || "generic")
    })
  },
})
