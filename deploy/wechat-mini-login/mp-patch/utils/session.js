const AUTH = "zq_auth_v2"

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

module.exports = { saveAuth, auth, patchAuth, clearAuth }
