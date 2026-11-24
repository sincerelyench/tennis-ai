/** ZQ-174: browse-first home — calm composition; no AI-generated notice here. */
Page({
  data: {
    features: [
      {
        title: "约球与挑战",
        desc: "按水平匹配本地球友，轻松约上一场。",
      },
      {
        title: "城市排行榜",
        desc: "看本地单打与女单排名，赛后分数有迹可循。",
      },
      {
        title: "AI 教练与网络教练",
        desc: "登录后可提问或留言，训练疑问有人答。",
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
