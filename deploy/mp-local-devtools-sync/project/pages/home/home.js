/** ZQ-175: launcher — guests enter H5 排行榜; logged-in users enter app. No browse marketing. */
const session = require("../../utils/session")

Page({
  data: {
    status: "正在进入…",
  },
  onShow() {
    const auth = session.auth()
    if (auth && auth.token) {
      this.setData({ status: "正在进入…" })
      wx.redirectTo({
        url: "/pages/web/web?token=" + encodeURIComponent(auth.token) + "&next=/ladder",
      })
      return
    }
    this.setData({ status: "正在进入排行榜…" })
    wx.redirectTo({
      url: "/pages/web/web?guest=1&next=/ladder",
    })
  },
})
