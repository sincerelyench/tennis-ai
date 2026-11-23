/** ZQ-168: WeChat 审核 — browse features before any login/auth. */
Page({
  data: {
    features: [
      {
        title: "约球与挑战",
        desc: "按水平匹配本地球友，发起约球与赛后交流。",
      },
      {
        title: "城市排行榜",
        desc: "查看无锡等地单打/女单排名与赛果变化。",
      },
      {
        title: "AI 教练问答",
        desc: "训练疑问可向 AI 教练提问；页面标注「AI生成」。",
      },
      {
        title: "真实网络教练",
        desc: "可选真人教练留言指导（登录后使用）。",
      },
    ],
  },
  onBrowseGuest() {
    // Public H5 guest page — no session / no phone auth.
    wx.navigateTo({ url: "/pages/web/web?guest=1&next=/guest" })
  },
  onOpenTerms() {
    wx.navigateTo({ url: "/pages/legal/legal?kind=terms" })
  },
  onOpenPrivacy() {
    wx.navigateTo({ url: "/pages/legal/legal?kind=privacy" })
  },
  onGoLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
  },
})
