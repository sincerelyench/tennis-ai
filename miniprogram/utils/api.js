const config = require("../config")

function base() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function fail(body, status) {
  let code = body && (body.code || body.error)
  if (!code) {
    if (status === 401) code = "auth_invalid"
    else if (status >= 500) code = "server"
    else code = "generic"
  }
  const err = new Error(typeof code === "string" ? code : "generic")
  err.code = typeof code === "string" ? code : "generic"
  err.detail =
    (body && (body.detail || body.error) && String(body.detail || body.error)) ||
    (typeof body.error === "string" ? body.error : "") ||
    ""
  return err
}

function request({ path, method, data, token }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: base() + path,
      method: method || "GET",
      data: data || {},
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      timeout: 20000,
      success(res) {
        const body = res.data && typeof res.data === "object" ? res.data : {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body)
          return
        }
        reject(fail(body, res.statusCode))
      },
      fail() {
        reject(fail({ code: "network" }, 0))
      },
    })
  })
}

function wechatLogin({ code, nickName }) {
  return request({
    path: "/api/auth/wechat",
    method: "POST",
    data: { code, nickName: nickName || "" },
  })
}

function accountLogin(payload) {
  return request({
    path: "/api/auth/login",
    method: "POST",
    data: payload || {},
  })
}

function sendPhoneCode({ phone }) {
  return request({
    path: "/api/auth/code",
    method: "POST",
    data: { phone: phone || "" },
  })
}

function session(token) {
  return request({ path: "/api/auth/session", token })
}

function updateProfile(token, patch) {
  return request({
    path: "/api/auth/profile",
    method: "PATCH",
    token,
    data: patch || {},
  })
}

function wechatSubscribeConfig(token) {
  return request({
    path: "/api/auth/wechat-subscribe",
    method: "GET",
    token,
  })
}

function reportWechatSubscribe(token, payload) {
  return request({
    path: "/api/auth/wechat-subscribe",
    method: "POST",
    token,
    data: payload || {},
  })
}

module.exports = {
  wechatLogin,
  accountLogin,
  sendPhoneCode,
  session,
  updateProfile,
  wechatSubscribeConfig,
  reportWechatSubscribe,
}
