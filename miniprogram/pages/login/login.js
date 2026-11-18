const api = require("../../utils/api")
const session = require("../../utils/session")

function enterApp(token) {
  wx.redirectTo({
    url: "/pages/web/web?token=" + encodeURIComponent(token),
  })
}

Page({
  data: {
    mode: "wechat",
    nickName: "",
    username: "",
    password: "",
    phone: "",
    smsCode: "",
    devCode: "",
    loading: false,
    codeLoading: false,
    error: "",
    notice: "",
  },
  onShow() {
    const auth = session.auth()
    if (auth && auth.token) {
      enterApp(auth.token)
    }
  },
  onMode(e) {
    const mode = (e.currentTarget.dataset && e.currentTarget.dataset.mode) || "wechat"
    this.setData({ mode, error: "", notice: "" })
  },
  onNick(e) {
    this.setData({ nickName: e.detail.value || "" })
  },
  onUsername(e) {
    this.setData({ username: e.detail.value || "" })
  },
  onPassword(e) {
    this.setData({ password: e.detail.value || "" })
  },
  onPhone(e) {
    this.setData({ phone: e.detail.value || "" })
  },
  onSmsCode(e) {
    this.setData({ smsCode: e.detail.value || "" })
  },
  finishLogin(body, notice) {
    if (!body || !body.token) {
      this.setData({ loading: false, error: "登录失败，请重试" })
      return
    }
    session.saveAuth(body)
    this.setData({ loading: false, notice: notice || "" })
    enterApp(body.token)
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
            return null
          }
          session.saveAuth(body)
          if (body.displayName) return body
          if (!nickName) return body
          return api
            .updateProfile(body.token, { displayName: nickName })
            .then((profile) => {
              session.patchAuth({
                displayName: (profile && profile.displayName) || nickName,
              })
              return body
            })
            .catch(() => body)
        })
        .then((body) => {
          if (!body) return
          const notice =
            body.loginMode === "wechat-mock"
              ? "当前为开发/模拟微信会话（未配置正式小程序密钥或测试码无效时）。"
              : ""
          this.finishLogin(body, notice)
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
  onPasswordLogin() {
    if (this.data.loading) return
    const username = String(this.data.username || "").trim()
    const password = String(this.data.password || "")
    if (!username || password.length < 4) {
      this.setData({ error: "请填写用户名（或手机号）和密码" })
      return
    }
    this.setData({ loading: true, error: "", notice: "" })
    api
      .accountLogin({ username, password })
      .then((body) => this.finishLogin(body))
      .catch((err) => {
        this.setData({
          loading: false,
          error: (err && (err.detail || err.message)) || "登录失败",
        })
      })
  },
  onSendCode() {
    if (this.data.codeLoading) return
    const phone = String(this.data.phone || "").trim()
    if (!/^\d{11}$/.test(phone)) {
      this.setData({ error: "请输入 11 位手机号" })
      return
    }
    this.setData({ codeLoading: true, error: "", notice: "", devCode: "" })
    api
      .sendPhoneCode({ phone })
      .then((body) => {
        this.setData({
          codeLoading: false,
          notice: "验证码已发送（开发环境可能直接显示在下方）",
          devCode: (body && body.code) || "",
          smsCode: (body && body.code) || this.data.smsCode,
        })
      })
      .catch((err) => {
        this.setData({
          codeLoading: false,
          error: (err && (err.detail || err.message)) || "发送失败",
        })
      })
  },
  onPhoneLogin() {
    if (this.data.loading) return
    const phone = String(this.data.phone || "").trim()
    const code = String(this.data.smsCode || "").trim()
    if (!/^\d{11}$/.test(phone) || !code) {
      this.setData({ error: "请填写手机号和验证码" })
      return
    }
    this.setData({ loading: true, error: "", notice: "" })
    api
      .accountLogin({ phone, code })
      .then((body) => this.finishLogin(body))
      .catch((err) => {
        this.setData({
          loading: false,
          error: (err && (err.detail || err.message)) || "登录失败",
        })
      })
  },
})
