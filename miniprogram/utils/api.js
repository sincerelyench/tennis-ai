const config = require("../config")

/** Opaque fail() codes — never show the raw English token in the UI. */
const FRIENDLY_ZH = {
  server: "服务器繁忙，请稍后重试",
  network: "网络异常，请检查网络后重试",
  generic: "操作失败，请稍后重试",
  auth_invalid: "登录已失效，请重新登录",
}

function base() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function fail(body, status) {
  let code = body && (body.code || body.error)
  if (typeof code !== "string" || !String(code).trim()) {
    if (status === 401) code = "auth_invalid"
    else if (status >= 500) code = "server"
    else if (!status) code = "network"
    else code = "generic"
  } else {
    code = String(code).trim()
  }
  // Gateway / HTML 5xx bodies often parse as {} — force opaque server code.
  if (status >= 500 && !FRIENDLY_ZH[code]) {
    code = "server"
  }
  let detailRaw =
    (body && typeof body.detail === "string" && body.detail) ||
    (body && typeof body.error === "string" && body.error) ||
    (body && typeof body.errmsg === "string" && body.errmsg) ||
    ""
  // ZQ-149 / #151: never surface raw "server" / "network" as the red login error text.
  if (FRIENDLY_ZH[code]) {
    detailRaw = FRIENDLY_ZH[code]
  }
  const err = new Error(detailRaw || FRIENDLY_ZH.generic)
  err.code = FRIENDLY_ZH[code] ? code : code
  err.detail = detailRaw
  if (body && body.errcode != null) err.errcode = body.errcode
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
  // ZQ-158: login page no longer sends nickName; profile-setup may still pass it later via updateProfile.
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

module.exports = {
  wechatLogin,
  accountLogin,
  sendPhoneCode,
  session,
  updateProfile,
}
