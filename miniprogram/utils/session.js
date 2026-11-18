const AUTH = "zq_auth_v2"
const GUIDE = "zq_guide"
const VIDEO = "zq_video"
const REPORTS = "zq_reports_local"

function read(key) {
  try {
    return wx.getStorageSync(key) || null
  } catch (e) {
    return null
  }
}

function saveAuth(payload) {
  const record = {
    token: payload.token,
    phone: payload.phone || "",
    openid: payload.openid || "",
    displayName: payload.displayName || "",
    role: payload.role || "player",
    cityId: payload.cityId || "",
    loginMode: payload.loginMode || "wechat",
    expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
  }
  wx.setStorageSync(AUTH, record)
  return record
}

function auth() {
  const record = read(AUTH)
  if (!record || !record.token) return null
  if (record.expiresAt && Number(record.expiresAt) <= Date.now()) return null
  return record
}

function patchAuth(fields) {
  const cur = auth() || {}
  const next = { ...cur, ...fields }
  wx.setStorageSync(AUTH, next)
  return next
}

function clearAuth() {
  try {
    wx.removeStorageSync(AUTH)
  } catch (e) {
    /* ignore */
  }
}

function saveGuide(checks) {
  wx.setStorageSync(GUIDE, checks || {})
}

function guide() {
  const saved = read(GUIDE) || {}
  return {
    side: !!saved.side,
    full_body: !!saved.full_body,
    racket: !!saved.racket,
  }
}

function saveVideo(video) {
  wx.setStorageSync(VIDEO, video || null)
}

function video() {
  return read(VIDEO)
}

function listReports() {
  const rows = read(REPORTS)
  return Array.isArray(rows) ? rows : []
}

function pushReport(row) {
  const rows = listReports()
  rows.unshift(row)
  wx.setStorageSync(REPORTS, rows.slice(0, 40))
  return rows
}

module.exports = {
  saveAuth,
  auth,
  patchAuth,
  clearAuth,
  saveGuide,
  guide,
  saveVideo,
  video,
  listReports,
  pushReport,
}
