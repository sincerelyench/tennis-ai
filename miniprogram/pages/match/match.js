const i18n = require("../../utils/i18n")
const { buildDemoMatch, filterPoints } = require("../../utils/match-demo")

const KEY = "zq-match-records-v1"

function loadMatches() {
  try {
    const raw = wx.getStorageSync(KEY)
    if (!raw) return []
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function saveMatches(rows) {
  try {
    wx.setStorageSync(KEY, rows)
  } catch (e) {}
}

Page({
  data: {
    lang: "zh-CN",
    zh: true,
    format: "singles",
    mode: "standard",
    records: [],
    note: "",
  },
  onShow() {
    const lang = i18n.getLang()
    const zh = lang !== "en"
    this.setData({
      lang,
      zh,
      records: loadMatches(),
    })
    wx.setNavigationBarTitle({ title: zh ? "比赛录制" : "Match record" })
  },
  setFormat(e) {
    this.setData({ format: e.currentTarget.dataset.format })
  },
  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },
  openMatch(match) {
    const rows = [match].concat(loadMatches().filter((m) => m.id !== match.id)).slice(0, 40)
    saveMatches(rows)
    wx.navigateTo({ url: "/pages/match-detail/match-detail?id=" + encodeURIComponent(match.id) })
  },
  onDemo() {
    const match = buildDemoMatch({
      format: this.data.format,
      mode: this.data.mode,
      title: this.data.zh ? "涨球演示赛" : "Zhangqiu demo match",
      seed: 1083,
    })
    this.setData({ note: this.data.zh ? "已生成演示比赛分析" : "Demo match ready" })
    this.openMatch(match)
  },
  onRecord() {
    const match = buildDemoMatch({
      format: this.data.format,
      mode: this.data.mode,
      title: this.data.zh ? (this.data.mode === "ground" ? "Ground Mode 录制" : "现场录制") : "Recorded match",
      seed: Date.now() % 1000000,
    })
    this.setData({
      note: this.data.zh
        ? "真机可录；本构建用本地演示流水线（GPU 球轨未完成时）。"
        : "Record on device; demo pipeline when GPU track incomplete.",
    })
    this.openMatch(match)
  },
  onOpen(e) {
    wx.navigateTo({ url: "/pages/match-detail/match-detail?id=" + encodeURIComponent(e.currentTarget.dataset.id) })
  },
  onStroke() {
    wx.navigateTo({ url: "/pages/guide/guide" })
  },
})
