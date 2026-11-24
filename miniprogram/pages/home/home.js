/** ZQ-168/173: WeChat 审核 — browse features before login; keep home simple. */
Page({
  data: {
    features: [
      {
        title: "约球与挑战",
        desc: "按水平匹配本地球友，发起约球与赛后交流。",
      },
      {
        title: "城市排行榜",
        desc: "查看本地单打 / 女单排名与赛果变化。",
      },
      {
        title: "AI 教练与网络教练",
        desc: "登录后可向 AI 教练提问，或向真人教练留言。",
      },
    ],
  },
  onBrowseGuest() {
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
