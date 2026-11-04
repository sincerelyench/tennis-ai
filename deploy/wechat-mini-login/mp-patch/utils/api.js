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
  err.detail = body && typeof body.error === "string" ? body.error : ""
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

function directory(token, query) {
  const q = query || {}
  const parts = []
  if (q.role) parts.push("role=" + encodeURIComponent(q.role))
  if (q.cityId) parts.push("cityId=" + encodeURIComponent(q.cityId))
  if (q.includeSelf) parts.push("includeSelf=1")
  const qs = parts.length ? "?" + parts.join("&") : ""
  return request({ path: "/api/friends/directory" + qs, token })
}

function createIntro(token, body) {
  return request({
    path: "/api/friends/intros",
    method: "POST",
    token,
    data: body || {},
  })
}

function listIntros(token) {
  return request({ path: "/api/friends/intros", token })
}

function introAction(token, body) {
  return request({
    path: "/api/friends/intros",
    method: "POST",
    token,
    data: body || {},
  })
}

module.exports = {
  wechatLogin,
  session,
  updateProfile,
  directory,
  createIntro,
  listIntros,
  introAction,
}
