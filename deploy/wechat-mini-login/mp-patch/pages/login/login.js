const api = require("../../utils/api")
const session = require("../../utils/session")

Page({
  data: {
    nickName: "",
    loading: false,
    error: "",
    notice: "",
  },
  onShow() {
    const auth = session.auth()
    if (auth && auth.token) {
      wx.redirectTo({ url: "/pages/play/play" })
    }
  },
  onNick(e) {
    this.setData({ nickName: e.detail.value || "" })
  },
  onWechatLogin() {
    if (this.data.loading) return
    this.setData({ loading: true, error: "", notice: "" })
    const nickName = String(this.data.nickName || "").trim()
    const finish = (code) => {
      api
        .wechatLogin({ code, nickName })
        .then((body) => {
          if (!body || !body.token) {
            this.setData({ loading: false, error: "登录失败，请重试" })
            return
          }
          session.saveAuth(body)
          if (body.displayName) {
            session.patchAuth({ displayName: body.displayName })
            return body
          }
          if (nickName) {
            return api
              .updateProfile(body.token, { displayName: nickName })
              .then((profile) => {
                session.patchAuth({
                  displayName: (profile && profile.displayName) || nickName,
                })
                return body
              })
              .catch(() => body)
          }
          return body
        })
        .then((body) => {
          if (!body || !body.token) return
          const notice =
            body.loginMode === "wechat-mock"
              ? "当前为开发/模拟微信会话（未配置正式小程序密钥或测试码无效时）。"
              : ""
          this.setData({ loading: false, notice })
          wx.redirectTo({ url: "/pages/play/play" })
        })
        .catch((err) => {
          this.setData({
            loading: false,
            error: (err && (err.detail || err.message)) || "登录失败",
          })
        })
    }
    wx.login({
      success: (res) => {
        if (res.code) finish(res.code)
        else finish("dev-" + Date.now())
      },
      fail: () => finish("dev-" + Date.now()),
    })
  },
})
