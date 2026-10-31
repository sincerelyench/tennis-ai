const i18n = require("../../utils/i18n")
const { filterPoints } = require("../../utils/match-demo")

const KEY = "zq-match-records-v1"

const STROKE_ZH = { forehand: "正手", backhand: "反手", serve: "发球", volley: "截击", overhead: "高压" }
const STROKE_EN = { forehand: "Forehand", backhand: "Backhand", serve: "Serve", volley: "Volley", overhead: "Overhead" }
const RESULT_ZH = {
  winner: "制胜分",
  forced_error: "压迫失误",
  unforced_error: "非受迫",
  ace: "发球直接得分",
  double_fault: "双误",
}
const RESULT_EN = {
  winner: "Winner",
  forced_error: "Forced error",
  unforced_error: "Unforced",
  ace: "Ace",
  double_fault: "Double fault",
}

function loadMatch(id) {
  try {
    const raw = wx.getStorageSync(KEY)
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return null
    return parsed.find((m) => m.id === id) || null
  } catch (e) {
    return null
  }
}

function sideLabel(zh, side, players) {
  players = players || {}
  if (side === "you") {
    const n = (players.you || "").trim()
    if (n && n !== "你" && n !== "我" && n.toLowerCase() !== "you") return zh ? n + "（你）" : n + " (you)"
    return zh ? "你（己方）" : "You"
  }
  const n = (players.opp || "").trim()
  if (n && n !== "对手" && n.toLowerCase() !== "opponent") return zh ? n + "（对手）" : n + " (opp)"
  return zh ? "对手" : "Opponent"
}

function speedLabel(zh, kmh) {
  return zh ? kmh + " 公里/时" : kmh + " km/h"
}

function decoratePoints(zh, points) {
  return (points || []).map((p) =>
    Object.assign({}, p, {
      resultLabel: zh ? RESULT_ZH[p.result] || p.result : RESULT_EN[p.result] || p.result,
    }),
  )
}

function activeShotRows(zh, match, activeId) {
  if (!match) return []
  const point = (match.points || []).find((p) => p.id === activeId) || filterPoints(match, {})[0] || null
  if (!point) return []
  return (point.shots || []).map((s, i) => {
    const n = s.shotIndex || i + 1
    const stroke = s.stroke || ""
    return {
      id: s.id || "shot-" + n,
      side: s.side,
      stroke: stroke,
      strokeLabel: zh ? STROKE_ZH[stroke] || stroke : STROKE_EN[stroke] || stroke,
      speedKmh: s.speedKmh,
      speedLabel: speedLabel(zh, s.speedKmh),
      rallyLabel: zh ? "第 " + n + " 拍" : "Shot " + n,
      sideLabel: sideLabel(zh, s.side, match.players),
    }
  })
}

function legend(zh, match) {
  const you = sideLabel(zh, "you", match && match.players)
  const opp = sideLabel(zh, "opp", match && match.players)
  return {
    legendYou: zh ? "蓝 = " + you : "Blue = " + you,
    legendOpp: zh ? "红 = " + opp : "Red = " + opp,
  }
}

function pageMeta(zh, match) {
  if (!match) {
    return {
      formatLabel: "",
      modeLabel: "",
      speedDisclaimer: "",
      avgSpeedLabel: "",
    }
  }
  return {
    formatLabel: match.format === "doubles" ? (zh ? "双打" : "Doubles") : zh ? "单打" : "Singles",
    modeLabel: match.mode === "ground" ? (zh ? "地面机位" : "Ground mode") : zh ? "标准机位" : "Standard",
    speedDisclaimer: zh
      ? match.speedDisclaimer || "球速为估测值，误差约 ±10%。"
      : "Speed estimate ±10%.",
    avgSpeedLabel: speedLabel(zh, (match.stats && match.stats.avgSpeedKmh) || 0),
  }
}

Page({
  data: {
    zh: true,
    match: null,
    points: [],
    activeId: "",
    activeShots: [],
    stroke: "all",
    result: "all",
    ballTrace: true,
    shareHint: "",
    legendYou: "",
    legendOpp: "",
    formatLabel: "",
    modeLabel: "",
    speedDisclaimer: "",
    avgSpeedLabel: "",
  },
  syncActive(activeId) {
    const zh = this.data.zh
    const match = this.data.match
    this.setData({
      activeId: activeId,
      activeShots: activeShotRows(zh, match, activeId),
      ...legend(zh, match),
    })
  },
  onLoad(query) {
    const zh = i18n.getLang() !== "en"
    const match = loadMatch(query.id)
    const rawPoints = match ? filterPoints(match, {}) : []
    const points = decoratePoints(zh, rawPoints)
    const activeId = points[0] ? points[0].id : ""
    this.setData({
      zh,
      match,
      points,
      activeId,
      activeShots: activeShotRows(zh, match, activeId),
      ...legend(zh, match),
      ...pageMeta(zh, match),
    })
    wx.setNavigationBarTitle({ title: zh ? "比赛回放" : "Match replay" })
  },
  setStroke(e) {
    const stroke = e.currentTarget.dataset.v
    const zh = this.data.zh
    const raw = filterPoints(this.data.match, { stroke, result: this.data.result })
    const points = decoratePoints(zh, raw)
    const activeId = points[0] ? points[0].id : ""
    this.setData({ stroke, points })
    this.syncActive(activeId)
  },
  setResult(e) {
    const result = e.currentTarget.dataset.v
    const zh = this.data.zh
    const raw = filterPoints(this.data.match, { stroke: this.data.stroke, result })
    const points = decoratePoints(zh, raw)
    const activeId = points[0] ? points[0].id : ""
    this.setData({ result, points })
    this.syncActive(activeId)
  },
  pickPoint(e) {
    this.syncActive(e.currentTarget.dataset.id)
  },
  toggleTrace() {
    this.setData({ ballTrace: !this.data.ballTrace })
  },
  jumpCoach(e) {
    this.syncActive(e.currentTarget.dataset.id)
  },
  onShare() {
    const id = this.data.match && this.data.match.id
    this.setData({
      shareHint: this.data.zh
        ? "分享钩子：复制网页链接（访客无需会员）。教练可在消息复盘。"
        : "Share via web link (viewer, no membership). Coach review via inbox.",
    })
    if (id) {
      wx.setClipboardData({ data: "https://yqchen.blog/tennis/analysis/match/" + id })
    }
  },
})
