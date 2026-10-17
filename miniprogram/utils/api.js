const config = require("../config")

function base() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function fail(body, status) {
  let code = body && body.code
  if (!code) {
    if (body && body.error) code = "generic"
    if (status === 401) code = "auth_invalid"
    else if (status === 409) code = "busy"
    else if (status === 413) code = "video_too_large"
    else if (status >= 500) code = "server"
    else if (!code) code = "generic"
  }
  const err = new Error(code)
  err.code = code
  err.detail =
    (body && typeof body.detail === "string" && body.detail) ||
    (body && typeof body.error === "string" && body.error) ||
    ""
  return err
}

function request({ path, method, data, token }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: base() + path,
      method: method || "GET",
      data: data || {},
      header: Object.assign(
        { "content-type": "application/json" },
        token ? { Authorization: "Bearer " + token } : {}
      ),
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

function requestCode(phone) {
  return request({
    path: "/api/auth/code",
    method: "POST",
    data: { phone: String(phone || "").trim() },
  })
}

function phoneLogin(phone, code) {
  return request({
    path: "/api/auth/login",
    method: "POST",
    data: { phone: String(phone || "").trim(), code: String(code || "").trim() },
  })
}

/** @deprecated 开发态 mock；线上包走 phoneLogin */
function mockLogin(code) {
  return request({ path: "/api/auth/mock", method: "POST", data: { code } })
}

function me(token) {
  return request({ path: "/api/auth/me", token })
}

function job(id, token) {
  return request({ path: "/api/jobs/" + encodeURIComponent(id), token })
}

function jobResult(id, token) {
  return request({ path: "/api/jobs/" + encodeURIComponent(id) + "/result", token })
}

function uploadVideo({ filePath, token, stroke, guideCompleted, guideChecks }) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(fail({ code: "auth_required" }, 401))
      return
    }
    // 开局只传技术动作，不传水平 / NTRP（与线上 Web / App 一致）。
    const formData = {
      stroke: stroke || "forehand",
      client: "miniprogram",
      title: "涨球挥拍分析",
      guide_completed: guideCompleted ? "1" : "0",
      guide_checks: JSON.stringify(guideChecks || {}),
    }
    wx.uploadFile({
      url: base() + "/api/analyze",
      filePath,
      name: "video",
      timeout: 120000,
      header: { Authorization: "Bearer " + token },
      formData,
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data || "{}")
        } catch (e) {
          reject(fail({ code: "bad_response" }, res.statusCode))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && (body.job_id || body.id)) {
          if (!body.job_id && body.id) body.job_id = body.id
          resolve(body)
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          reject(fail({ code: "bad_response" }, res.statusCode))
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

module.exports = {
  requestCode,
  phoneLogin,
  mockLogin,
  me,
  job,
  jobResult,
  uploadVideo,
}
