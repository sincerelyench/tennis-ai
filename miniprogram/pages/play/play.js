const api = require("../../utils/api")
const session = require("../../utils/session")

const LEVELS = [2, 2.5, 3, 3.5, 4, 4.5, 5]
const CITIES = [
  ["beijing", "北京"],
  ["shanghai", "上海"],
  ["guangzhou", "广州"],
  ["shenzhen", "深圳"],
  ["hangzhou", "杭州"],
  ["nanjing", "南京"],
  ["suzhou", "苏州"],
  ["wuxi", "无锡"],
  ["chengdu", "成都"],
  ["chongqing", "重庆"],
  ["wuhan", "武汉"],
  ["xian", "西安"],
  ["tianjin", "天津"],
  ["qingdao", "青岛"],
  ["xiamen", "厦门"],
  ["changsha", "长沙"],
  ["zhengzhou", "郑州"],
  ["hefei", "合肥"],
  ["ningbo", "宁波"],
  ["dongguan", "东莞"],
]
const NEARBY = {
  wuxi: ["suzhou", "shanghai", "nanjing", "hangzhou"],
  suzhou: ["wuxi", "shanghai", "hangzhou", "nanjing"],
  shanghai: ["suzhou", "wuxi", "hangzhou", "ningbo"],
  hangzhou: ["shanghai", "ningbo", "suzhou", "nanjing"],
  nanjing: ["wuxi", "suzhou", "hefei", "hangzhou"],
  beijing: ["tianjin"],
  tianjin: ["beijing"],
  guangzhou: ["shenzhen", "dongguan"],
  shenzhen: ["guangzhou", "dongguan"],
  dongguan: ["guangzhou", "shenzhen"],
  chengdu: ["chongqing"],
  chongqing: ["chengdu"],
  wuhan: ["changsha", "hefei"],
  changsha: ["wuhan"],
  xian: ["zhengzhou"],
  zhengzhou: ["xian", "hefei"],
  hefei: ["nanjing", "wuhan", "zhengzhou"],
  ningbo: ["hangzhou", "shanghai"],
  qingdao: ["beijing", "tianjin"],
  xiamen: ["guangzhou", "shenzhen"],
}

Page({
  data: {
    displayName: "",
    draftName: "",
    needName: false,
    cityIndex: 7,
    cityLabels: CITIES.map((c) => c[1]),
    cityLabel: "无锡",
    cityId: "wuxi",
    levelIndex: 3,
    levelLabels: LEVELS.map((n) => String(n)),
    level: 3.5,
    phase: "idle",
    searchHint: "",
    matching: false,
    buddy: null,
    players: [],
    intros: [],
  },
  _timer: null,
  _hintTimer: null,
  onShow() {
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    this.setData({
      displayName: auth.displayName || "",
      draftName: auth.displayName || "",
      needName: !auth.displayName,
    })
    this.refreshDirectory()
    this.refreshIntros()
  },
  onHide() {
    this.clearTimers()
  },
  onUnload() {
    this.clearTimers()
  },
  clearTimers() {
    if (this._timer) clearTimeout(this._timer)
    if (this._hintTimer) clearInterval(this._hintTimer)
    this._timer = null
    this._hintTimer = null
  },
  token() {
    const auth = session.auth()
    return auth && auth.token
  },
  onDraftName(e) {
    this.setData({ draftName: e.detail.value || "" })
  },
  onEditName() {
    this.setData({ needName: true, draftName: this.data.displayName || "" })
  },
  onSaveName() {
    const name = String(this.data.draftName || "").trim()
    const token = this.token()
    if (!name || !token) return
    api
      .updateProfile(token, { displayName: name, cityId: this.data.cityId, level: this.data.level })
      .then((res) => {
        const displayName = (res && res.displayName) || name
        session.patchAuth({ displayName })
        this.setData({ displayName, needName: !displayName, draftName: displayName })
        this.refreshDirectory()
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || "保存失败", icon: "none" })
      })
  },
  onCity(e) {
    const i = Number(e.detail.value || 0)
    const city = CITIES[i] || CITIES[7]
    this.setData({ cityIndex: i, cityId: city[0], cityLabel: city[1] })
    const token = this.token()
    if (token) {
      api.updateProfile(token, { cityId: city[0] }).catch(() => {})
    }
    this.refreshDirectory()
  },
  onLevel(e) {
    const i = Number(e.detail.value || 0)
    const level = LEVELS[i] || 3.5
    this.setData({ levelIndex: i, level })
    const token = this.token()
    if (token) api.updateProfile(token, { level }).catch(() => {})
  },
  refreshDirectory() {
    const token = this.token()
    if (!token) return
    api
      .directory(token, { role: "player", cityId: this.data.cityId, includeSelf: 1 })
      .then((data) => {
        const self = data && data.self
        if (self && self.displayName) {
          session.patchAuth({ displayName: self.displayName })
          this.setData({
            displayName: self.displayName,
            needName: false,
            draftName: self.displayName,
          })
        }
        const me = (session.auth() || {}).phone
        const users = ((data && data.users) || [])
          .filter((u) => u && u.displayName && u.id !== me)
          .map((u) => ({
            id: u.id,
            name: u.displayName,
            level: u.level || 3.5,
            cityId: u.cityId || "",
          }))
        this.setData({ players: users })
      })
      .catch((err) => {
        if (err && (err.code === "auth_invalid" || /sign in/i.test(err.detail || ""))) {
          session.clearAuth()
          wx.redirectTo({ url: "/pages/login/login" })
        }
      })
  },
  refreshIntros() {
    const token = this.token()
    if (!token) return
    api
      .listIntros(token)
      .then((data) => {
        const rows = []
          .concat((data && data.active) || [])
          .concat((data && data.mine) || [])
          .concat((data && data.inbox) || [])
        const seen = {}
        const intros = []
        rows.forEach((row) => {
          if (!row || !row.id || seen[row.id]) return
          seen[row.id] = true
          intros.push({
            id: row.id,
            title: row.title || row.toName || row.fromName || "约球",
            status: row.statusText || row.status || "",
            canCancel: /pending|active|waiting/i.test(String(row.status || "")) || !!row.canCancel,
          })
        })
        this.setData({ intros: intros.slice(0, 12) })
      })
      .catch(() => {})
  },
  pickBuddy(pool) {
    const level = this.data.level
    const cityId = this.data.cityId
    const me = (session.auth() || {}).phone
    const candidates = (pool || []).filter((p) => p.id !== me && p.name)
    if (!candidates.length) return null
    const same = candidates
      .filter((p) => p.cityId === cityId)
      .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
    if (same.length) {
      const buddy = same[0]
      const delta = Math.abs(buddy.level - level).toFixed(1)
      return {
        id: buddy.id,
        name: buddy.name,
        meta: cityLabelOf(buddy.cityId) + " · 水平 " + buddy.level,
        reason: "同城，水平相差 " + delta,
      }
    }
    const nearIds = NEARBY[cityId] || []
    const near = candidates
      .filter((p) => nearIds.indexOf(p.cityId) >= 0)
      .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
    if (near.length) {
      const buddy = near[0]
      const delta = Math.abs(buddy.level - level).toFixed(1)
      return {
        id: buddy.id,
        name: buddy.name,
        meta: cityLabelOf(buddy.cityId) + " · 水平 " + buddy.level,
        reason: "邻近城市，水平相差 " + delta,
      }
    }
    const any = candidates.slice().sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))[0]
    return {
      id: any.id,
      name: any.name,
      meta: cityLabelOf(any.cityId) + " · 水平 " + any.level,
      reason: "当前可匹配中最接近的球友",
    }
  },
  onStartMatch() {
    if (this.data.matching) return
    if (!this.data.displayName) {
      this.setData({ needName: true })
      wx.showToast({ title: "请先设置显示名", icon: "none" })
      return
    }
    const hints = ["扫描同城球友…", "比对水平接近度…", "核对自评水平…", "锁定合适对手…"]
    let hi = 0
    this.setData({ phase: "searching", matching: true, searchHint: hints[0], buddy: null })
    this._hintTimer = setInterval(() => {
      hi = (hi + 1) % hints.length
      this.setData({ searchHint: hints[hi] })
    }, 700)
    const token = this.token()
    api
      .directory(token, { role: "player", includeSelf: 1 })
      .then((data) => {
        const me = (session.auth() || {}).phone
        const pool = ((data && data.users) || [])
          .filter((u) => u && u.displayName && u.id !== me)
          .map((u) => ({
            id: u.id,
            name: u.displayName,
            level: u.level || 3.5,
            cityId: u.cityId || "",
          }))
        this._timer = setTimeout(() => {
          this.clearTimers()
          const buddy = this.pickBuddy(pool)
          if (!buddy) {
            this.setData({ phase: "empty", matching: false })
            return
          }
          this.setData({ phase: "found", matching: false, buddy })
        }, 1800)
      })
      .catch(() => {
        this.clearTimers()
        this.setData({ phase: "empty", matching: false })
      })
  },
  onCancelSearch() {
    this.clearTimers()
    this.setData({ phase: "idle", matching: false })
  },
  onRematch() {
    this.clearTimers()
    this.setData({ phase: "idle", buddy: null, matching: false })
  },
  onSendIntro() {
    const buddy = this.data.buddy
    const token = this.token()
    if (!buddy || !token) return
    api
      .createIntro(token, {
        action: "create",
        toName: buddy.name,
        buddyId: buddy.id,
        cityId: this.data.cityId,
        kind: "match",
        openIntro: true,
        locale: "zh",
      })
      .then(() => {
        wx.showToast({ title: "已发送约球招呼", icon: "none" })
        this.refreshIntros()
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || "发送失败", icon: "none" })
      })
  },
  onChallenge(e) {
    const name = e.currentTarget.dataset.name
    const id = e.currentTarget.dataset.id
    const token = this.token()
    if (!token || !name) return
    api
      .createIntro(token, {
        action: "create",
        toName: name,
        buddyId: id,
        cityId: this.data.cityId,
        kind: "challenge",
        openIntro: true,
        locale: "zh",
      })
      .then(() => {
        wx.showToast({ title: "已发起挑战", icon: "none" })
        this.refreshIntros()
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || "失败", icon: "none" })
      })
  },
  onCancelIntro(e) {
    const id = e.currentTarget.dataset.id
    const token = this.token()
    if (!id || !token) return
    api
      .introAction(token, { action: "cancel", id })
      .then(() => this.refreshIntros())
      .catch(() => {})
  },
  onLogout() {
    session.clearAuth()
    wx.redirectTo({ url: "/pages/login/login" })
  },
})

function cityLabelOf(id) {
  for (let i = 0; i < CITIES.length; i++) {
    if (CITIES[i][0] === id) return CITIES[i][1]
  }
  return id || "未知"
}
