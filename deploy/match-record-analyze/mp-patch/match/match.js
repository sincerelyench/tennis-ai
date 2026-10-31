const i18n = require("../../utils/i18n")
const { buildDemoMatch } = require("../../utils/match-demo")
const { camFields, cameraSetupCopy } = require("../../utils/camera-setup")

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
    confirmLive: false,
    recording: false,
    recordLabel: "",
    camTitle: "",
    camSubtitle: "",
    camModeTitle: "",
    camTips: [],
    duringTitle: "",
    duringText: "",
  },
  applyCam() {
    const zh = this.data.zh
    const fields = camFields(zh, this.data.mode)
    const cam = cameraSetupCopy(zh)
    this.setData({
      ...fields,
      recordLabel: this.data.confirmLive
        ? cam.ready
        : zh
          ? "开始录制 / 上传流水线"
          : "Record / upload pipeline",
    })
  },
  onShow() {
    const lang = i18n.getLang()
    const zh = lang !== "en"
    this.setData({
      lang,
      zh,
      records: loadMatches(),
    })
    this.applyCam()
    wx.setNavigationBarTitle({ title: zh ? "比赛录制" : "Match record" })
  },
  setFormat(e) {
    this.setData({ format: e.currentTarget.dataset.format })
  },
  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, confirmLive: false })
    this.applyCam()
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
    this.setData({ note: this.data.zh ? "已生成演示比赛分析" : "Demo match ready", confirmLive: false, recording: false })
    this.applyCam()
    this.openMatch(match)
  },
  onRecord() {
    if (!this.data.confirmLive) {
      this.setData({
        confirmLive: true,
        note: this.data.zh
          ? "请先确认上方机位要点，再点「机位 OK，开始录制」。"
          : "Confirm framing tips above, then tap Framing OK — start.",
      })
      this.applyCam()
      return
    }
    const cam = cameraSetupCopy(this.data.zh)
    this.setData({
      recording: true,
      note: this.data.zh
        ? "录制中：保持机位稳定。真机可录；本构建用本地演示流水线。"
        : "Recording: keep framing stable. Demo pipeline when GPU track incomplete.",
    })
    const match = buildDemoMatch({
      format: this.data.format,
      mode: this.data.mode,
      title: this.data.zh ? (this.data.mode === "ground" ? "Ground Mode 录制" : "现场录制") : "Recorded match",
      seed: Date.now() % 1000000,
    })
    setTimeout(() => {
      this.setData({ confirmLive: false, recording: false })
      this.applyCam()
      this.openMatch(match)
    }, 400)
  },
  onOpen(e) {
    wx.navigateTo({ url: "/pages/match-detail/match-detail?id=" + encodeURIComponent(e.currentTarget.dataset.id) })
  },
  onStroke() {
    wx.navigateTo({ url: "/pages/guide/guide" })
  },
})
