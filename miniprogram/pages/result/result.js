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

function fmtKmh(v) {
  if (v == null || v === "") return ""
  const n = Number(v)
  if (!Number.isFinite(n)) return ""
  return n >= 20 ? String(Math.round(n)) : n.toFixed(1)
}

function radarClip(axes) {
  const order = ["balance", "contact", "chain", "effect"]
  const byKey = {}
  ;(axes || []).forEach((a) => { byKey[a.key] = a })
  const pts = order.map((key, i) => {
    const axis = byKey[key] || {}
    const max = Number(axis.max) || 1
    const known = typeof axis.score === "number"
    const v = known ? Math.max(0, Math.min(1, axis.score / max)) : 0
    const ang = -Math.PI / 2 + i * (Math.PI / 2)
    const x = 50 + Math.cos(ang) * 46 * v
    const y = 50 + Math.sin(ang) * 46 * v
    return x.toFixed(1) + "% " + y.toFixed(1) + "%"
  })
  return "clip-path: polygon(" + pts.join(", ") + ");"
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
    dimCards: [],
    speedCards: [],
    speedEmpty: true,
    speedNote: "",
    radarStyle: "",
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
      dimCards: [],
      speedCards: [],
      speedEmpty: true,
      speedNote: "",
      radarStyle: "",
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
        score: known ? axis.score : null,
        max,
      }
    })
    const dimCards = axes.map((axis) => ({
      key: axis.key,
      label: axis.label,
      score: typeof axis.score === "number" ? String(axis.score) : i18n.lookup(lang, "result.noNumber"),
      max: typeof axis.score === "number" ? String(axis.max) : "",
      width: axis.width,
    }))
    const speeds = payload.speeds || null
    const racketLab = speeds && speeds.swing_from === "wrist"
      ? i18n.lookup(lang, "result.speed.racketWrist")
      : i18n.lookup(lang, "result.speed.racket")
    const speedDefs = speeds ? [
      ["racket", racketLab, speeds.racket_kmh],
      ["wrist", i18n.lookup(lang, "result.speed.wrist"), speeds.wrist_kmh],
      ["hip", i18n.lookup(lang, "result.speed.hip"), speeds.hip_kmh],
      ["ballIn", i18n.lookup(lang, "result.speed.ballIn"), speeds.ball_in_kmh],
      ["ballOut", i18n.lookup(lang, "result.speed.ballOut"), speeds.ball_out_kmh],
    ] : []
    const speedCards = speedDefs.map(([key, label, val]) => {
      const n = fmtKmh(val)
      return {
        key,
        label,
        value: n || i18n.lookup(lang, "result.noNumber"),
        unit: n ? "km/h" : "",
      }
    })
    const maxNote = speeds ? fmtKmh(speeds.racket_kmh_max) : ""
    const speedNote = speeds
      ? (maxNote
        ? i18n.format(lang, "result.speedNoteMax", { max: maxNote })
        : i18n.lookup(lang, "result.speedNote"))
      : ""
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
      dimCards,
      speedCards,
      speedEmpty: !speeds,
      speedNote,
      radarStyle: radarClip(payload.axes),
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
