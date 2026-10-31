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

Page({
  data: {
    zh: true,
    match: null,
    points: [],
    activeId: "",
    stroke: "all",
    result: "all",
    ballTrace: true,
    shareHint: "",
  },
  onLoad(query) {
    const zh = i18n.getLang() !== "en"
    const match = loadMatch(query.id)
    const points = match ? filterPoints(match, {}) : []
    this.setData({
      zh,
      match,
      points,
      activeId: points[0] ? points[0].id : "",
    })
    wx.setNavigationBarTitle({ title: zh ? "比赛回放" : "Match replay" })
  },
  setStroke(e) {
    const stroke = e.currentTarget.dataset.v
    const points = filterPoints(this.data.match, { stroke, result: this.data.result })
    this.setData({ stroke, points, activeId: points[0] ? points[0].id : "" })
  },
  setResult(e) {
    const result = e.currentTarget.dataset.v
    const points = filterPoints(this.data.match, { stroke: this.data.stroke, result })
    this.setData({ result, points, activeId: points[0] ? points[0].id : "" })
  },
  pickPoint(e) {
    this.setData({ activeId: e.currentTarget.dataset.id })
  },
  toggleTrace() {
    this.setData({ ballTrace: !this.data.ballTrace })
  },
  jumpCoach(e) {
    this.setData({ activeId: e.currentTarget.dataset.id })
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
