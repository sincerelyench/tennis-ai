const config = require("../config")

function base() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function fail(body, status) {
  let code = body && body.code
  if (!code) {
    if (status === 401) code = "auth_invalid"
    else if (status === 409) code = "busy"
    else if (status === 413) code = "video_too_large"
    else if (status >= 500) code = "server"
    else code = "generic"
  }
  const err = new Error(code)
  err.code = code
  err.detail = body && typeof body.detail === "string" ? body.detail : ""
  return err
}

function request({ path, method, data, token }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: base() + path,
      method: method || "GET",
      data: data || {},
      header: token ? { Authorization: "Bearer " + token } : {},
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

function mockLogin(code) {
  return request({ path: "/api/auth/mock", method: "POST", data: { code } })
}

function me(token) {
  return request({ path: "/api/auth/me", token })
}

function job(id, token) {
  return request({ path: "/api/jobs/" + encodeURIComponent(id), token })
}

function uploadVideo({ filePath, token, stroke, guideCompleted, guideChecks }) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(fail({ code: "auth_required" }, 401))
      return
    }
    wx.uploadFile({
      url: base() + "/api/analyze",
      filePath,
      name: "video",
      timeout: 120000,
      header: { Authorization: "Bearer " + token },
      formData: {
        stroke: stroke || "forehand",
        client: "miniprogram",
        sample: "0",
        level: "3.0",
        title: "涨球挥拍分析",
        guide_completed: guideCompleted ? "1" : "0",
        guide_checks: JSON.stringify(guideChecks || {}),
      },
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data || "{}")
        } catch (e) {
          reject(fail({ code: "bad_response" }, res.statusCode))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.job_id) {
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

module.exports = { mockLogin, me, job, uploadVideo }
