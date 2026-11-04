const config = require("../config")

function base() {
  return String(config.apiBase || "").replace(/\/$/, "")
}

function fail(body, status) {
  let code = body && (body.code || body.error)
  if (!code) {
    if (status === 401) code = "auth_invalid"
    else if (status === 409) code = "busy"
    else if (status === 413) code = "video_too_large"
    else if (status >= 500) code = "server"
    else code = "generic"
  }
  const err = new Error(typeof code === "string" ? code : "generic")
  err.code = typeof code === "string" ? code : "generic"
  err.detail =
    (body && (body.detail || body.error) && String(body.detail || body.error)) || ""
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

function listScores(token) {
  return request({ path: "/api/friends/scores", token })
}

function submitScore(token, body) {
  return request({
    path: "/api/friends/scores",
    method: "POST",
    token,
    data: body || {},
  })
}

function scoreAction(token, body) {
  return request({
    path: "/api/friends/scores/action",
    method: "POST",
    token,
    data: body || {},
  })
}

function job(id, token) {
  return request({ path: "/api/jobs/" + encodeURIComponent(id), token })
}

function jobResult(id, token) {
  return request({ path: "/api/jobs/" + encodeURIComponent(id) + "/result", token })
}

function coachChat(token, body) {
  return request({
    path: "/api/coach/chat",
    method: "POST",
    token,
    data: body || {},
  })
}

function geoCity(token) {
  return request({ path: "/api/geo/city", token })
}

function uploadVideo({ filePath, token, stroke, guideCompleted, guideChecks, title }) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(fail({ code: "auth_required" }, 401))
      return
    }
    wx.uploadFile({
      url: base() + "/api/analyze",
      filePath,
      name: "video",
      timeout: 180000,
      header: { Authorization: "Bearer " + token },
      formData: {
        stroke: stroke || "forehand",
        client: "miniprogram",
        sample: "0",
        level: "",
        title: title || "涨球挥拍分析",
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
        if (res.statusCode >= 200 && res.statusCode < 300 && (body.job_id || body.jobId)) {
          if (!body.job_id && body.jobId) body.job_id = body.jobId
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
  wechatLogin,
  session,
  updateProfile,
  directory,
  createIntro,
  listIntros,
  introAction,
  listScores,
  submitScore,
  scoreAction,
  job,
  jobResult,
  coachChat,
  geoCity,
  uploadVideo,
}
