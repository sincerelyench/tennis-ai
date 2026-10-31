const i18n = require("../../utils/i18n")
const { filterPoints } = require("../../utils/match-demo")

const KEY = "zq-match-records-v1"

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
    if (n && n !== "你" && n !== "我") return zh ? n + "（你）" : n + " (you)"
    return zh ? "你（己方）" : "You"
  }
  const n = (players.opp || "").trim()
  if (n && n !== "对手") return zh ? n + "（对手）" : n + " (opp)"
  return zh ? "对手" : "Opponent"
}

function activeShotRows(zh, match, activeId) {
  if (!match) return []
  const point = (match.points || []).find((p) => p.id === activeId) || (filterPoints(match, {})[0] || null)
  if (!point) return []
  return (point.shots || []).map((s, i) => {
    const n = s.shotIndex || i + 1
    return {
      id: s.id || "shot-" + n,
      side: s.side,
      stroke: s.stroke || "",
      speedKmh: s.speedKmh,
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
    const points = match ? filterPoints(match, {}) : []
    const activeId = points[0] ? points[0].id : ""
    this.setData({
      zh,
      match,
      points,
      activeId,
      activeShots: activeShotRows(zh, match, activeId),
      ...legend(zh, match),
    })
    wx.setNavigationBarTitle({ title: zh ? "比赛回放" : "Match replay" })
  },
  setStroke(e) {
    const stroke = e.currentTarget.dataset.v
    const points = filterPoints(this.data.match, { stroke, result: this.data.result })
    const activeId = points[0] ? points[0].id : ""
    this.setData({ stroke, points })
    this.syncActive(activeId)
  },
  setResult(e) {
    const result = e.currentTarget.dataset.v
    const points = filterPoints(this.data.match, { stroke: this.data.stroke, result })
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
        ? "分享钩子：复制 web 链接 https://yqchen.blog/tennis/share/m/…（访客无需会员）。教练可在消息复盘。"
        : "Share via web https://yqchen.blog/tennis/share/m/… (viewer, no membership). Coach review via inbox.",
    })
    if (id) {
      wx.setClipboardData({ data: "https://yqchen.blog/tennis/analysis/match/" + id })
    }
  },
})
