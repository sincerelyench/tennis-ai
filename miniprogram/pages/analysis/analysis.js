const session = require("../../utils/session")

Page({
  data: {
    reports: [],
  },
  onShow() {
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    this.setData({ reports: session.listReports() })
  },
  onNewAnalysis() {
    wx.navigateTo({ url: "/pages/upload/upload" })
  },
  onGuide() {
    wx.navigateTo({ url: "/pages/guide/guide" })
  },
  onOpenReport(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: "/pages/result/result?jobId=" + encodeURIComponent(id) })
  },
})
