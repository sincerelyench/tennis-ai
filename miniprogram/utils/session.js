const AUTH = "zq_auth"
const GUIDE = "zq_guide"
const VIDEO = "zq_video"

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
    userId: payload.user && payload.user.id,
    expiresAt: Date.now() + Number(payload.expires_in || 0) * 1000,
  }
  wx.setStorageSync(AUTH, record)
  return record
}

function auth() {
  const record = read(AUTH)
  if (!record || !record.token || Number(record.expiresAt) <= Date.now()) return null
  return record
}

function clearAuth() {
  try { wx.removeStorageSync(AUTH) } catch (e) { /* ignore */ }
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

module.exports = { saveAuth, auth, clearAuth, saveGuide, guide, saveVideo, video }
