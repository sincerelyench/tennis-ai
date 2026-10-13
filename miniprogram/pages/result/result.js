const i18n = require("../../utils/i18n")
const api = require("../../utils/api")
const session = require("../../utils/session")
const errors = require("../../utils/errors")
const config = require("../../config")

function bandKey(score, max) {
  if (typeof score !== "number" || !max) return ""
  const ratio = score / max
  if (ratio >= 0.8) return "high"
  if (ratio >= 0.6) return "mid"
  return "low"
}

function whenLabel(iso) {
  return String(iso || "").replace("T", " ").slice(0, 16)
}

function deltaText(value) {
  const n = Number(value) || 0
  return n > 0 ? "+" + n : String(n)
}

function absUrl(path) {
  if (!path) return ""
  if (/^https?:\/\//.test(path)) return path
  return String(config.apiBase || "").replace(/\/$/, "") + path
}

Page({
  data: {
    lang: "zh-CN",
    copy: i18n.pack("zh-CN"),
    loading: true,
    error: "",
    jobId: "",
    strokeLabel: "",
    guideWarning: false,
    serveNote: "",
    shot: "",
    contactLine: "",
    totalLine: "",
    focus: "",
    axes: [],
    timeline: [],
    compareReady: false,
    compareReason: "",
    compareWhen: "",
    deltas: [],
  },
  onLoad(options) {
    this.jobId = (options && options.job_id) || ""
  },
  onShow() {
    if (!session.auth()) {
      wx.redirectTo({ url: "/pages/home/home" })
      return
    }
    this.paint(i18n.getLang())
    if (!this.jobId) {
      this.errorCode = "result_missing"
      this.payload = null
      this.paint(i18n.getLang())
      return
    }
    this.load()
  },
  paint(lang) {
    const copy = i18n.pack(lang)
    const payload = this.payload
    const view = payload ? this.present(lang, payload) : {
      strokeLabel: "",
      guideWarning: false,
      serveNote: "",
      shot: "",
      contactLine: "",
      totalLine: "",
      focus: "",
      axes: [],
      timeline: [],
      compareReady: false,
      compareReason: "",
      compareWhen: "",
      deltas: [],
    }
    this.setData(Object.assign({
      lang,
      copy,
      jobId: this.jobId || "",
      loading: !payload && !this.errorCode,
      error: this.errorCode ? errors.message(lang, { code: this.errorCode }) : "",
    }, view))
    wx.setNavigationBarTitle({ title: copy.appTitle })
  },
  present(lang, payload) {
    const axes = (payload.axes || []).map((axis) => {
      const max = Number(axis.max) || 0
      const known = typeof axis.score === "number"
      const band = known ? bandKey(axis.score, max) : ""
      return {
        key: axis.key,
        label: i18n.lookup(lang, "result.axes." + axis.key),
        scoreText: known ? axis.score + "/" + max : i18n.lookup(lang, "result.noNumber"),
        width: known && max ? Math.max(0, Math.min(100, Math.round((axis.score / max) * 100))) : 0,
        band: band ? i18n.lookup(lang, "result.bands." + band) : "",
        tip: axis.tip || "",
      }
    })
    const progress = payload.progress || {}
    const timeline = (progress.items || []).map((item) => ({
      jobId: item.job_id,
      current: !!item.current,
      when: whenLabel(item.created_at),
      thumb: absUrl(item.thumbnail),
      bits: ["balance", "contact", "chain", "effect"].map((key) => {
        const value = item.scores ? item.scores[key] : null
        const shown = typeof value === "number" ? value : i18n.lookup(lang, "result.noNumber")
        return i18n.lookup(lang, "result.axes." + key) + " " + shown
      }).join(" · "),
      contact: typeof item.contact_t === "number"
        ? i18n.format(lang, "result.contactAt", { t: item.contact_t })
        : "",
    }))
    const card = progress.comparison
    const deltas = progress.compare_ready && card
      ? (payload.axes || []).map((axis) => {
        const before = card.earlier && card.earlier.scores ? card.earlier.scores[axis.key] : ""
        const after = card.later && card.later.scores ? card.later.scores[axis.key] : ""
        const delta = card.deltas ? card.deltas[axis.key] : 0
        return {
          key: axis.key,
          label: i18n.lookup(lang, "result.axes." + axis.key),
          before,
          after,
          delta: deltaText(delta),
          cls: delta > 0 ? "up" : (delta < 0 ? "down" : ""),
        }
      })
      : []
    const reason = progress.reason || "need_two"
    const grade = payload.grade ? i18n.lookup(lang, "result.grades." + payload.grade) : ""
    return {
      strokeLabel: i18n.lookup(lang, "result.strokes." + payload.stroke) || payload.stroke || "",
      guideWarning: !!payload.guide_warning,
      serveNote: payload.stroke === "serve" ? i18n.lookup(lang, "result.serveNote") : "",
      shot: absUrl(payload.thumbnail),
      contactLine: typeof payload.contact_t === "number"
        ? i18n.format(lang, "result.contactAt", { t: payload.contact_t })
        : "",
      totalLine: typeof payload.total === "number"
        ? i18n.format(lang, "result.total", { score: payload.total, grade })
        : "",
      focus: payload.focus || "",
      axes,
      timeline,
      compareReady: !!progress.compare_ready,
      compareReason: i18n.format(lang, "result.reasons." + reason, { count: progress.count || 0 }),
      compareWhen: card
        ? i18n.lookup(lang, "result.earlier") + " " + whenLabel(card.earlier && card.earlier.created_at) +
          " · " + i18n.lookup(lang, "result.later") + " " + whenLabel(card.later && card.later.created_at)
        : "",
      deltas,
    }
  },
  onSwitch(e) {
    this.paint(i18n.setLang(e.currentTarget.dataset.lang))
  },
  load() {
    const auth = session.auth()
    this.errorCode = ""
    this.payload = null
    this.paint(i18n.getLang())
    api.jobResult(this.jobId, auth && auth.token).then((body) => {
      if (!body || !body.axes) {
        this.errorCode = "generic"
        this.payload = null
      } else {
        this.payload = body
        this.errorCode = ""
      }
      this.paint(i18n.getLang())
    }).catch((err) => {
      this.payload = null
      this.errorCode = (err && err.code) || "generic"
      this.paint(i18n.getLang())
    })
  },
  onQueue() {
    wx.navigateBack({ delta: 1 })
  },
  onHome() {
    wx.reLaunch({ url: "/pages/home/home" })
  },
})
