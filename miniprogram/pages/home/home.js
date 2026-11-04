const session = require("../../utils/session")

Page({
  onShow() {
    if (session.auth()) {
      wx.switchTab({ url: "/pages/analysis/analysis" })
    } else {
      wx.redirectTo({ url: "/pages/login/login" })
    }
  },
})
