const api = require("../../utils/api")
const session = require("../../utils/session")

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
  ["taipei", "台北"],
]

Page({
  data: {
    displayName: "",
    draftName: "",
    roleLabel: "球员",
    cityIndex: 7,
    cityLabels: CITIES.map((c) => c[1]),
    cityLabel: "无锡",
    cityId: "wuxi",
    savingName: false,
    nameNote: "",
    cityNote: "",
  },
  onShow() {
    const auth = session.auth()
    if (!auth || !auth.token) {
      wx.redirectTo({ url: "/pages/login/login" })
      return
    }
    let cityIndex = 7
    const cityId = auth.cityId || "wuxi"
    for (let i = 0; i < CITIES.length; i++) {
      if (CITIES[i][0] === cityId) {
        cityIndex = i
        break
      }
    }
    this.setData({
      displayName: auth.displayName || "",
      draftName: auth.displayName || "",
      roleLabel: auth.role === "coach" ? "教练" : "球员",
      cityIndex,
      cityId: CITIES[cityIndex][0],
      cityLabel: CITIES[cityIndex][1],
    })
    api
      .session(auth.token)
      .then((body) => {
        if (!body) return
        const name = body.displayName || auth.displayName || ""
        const nextCity = body.cityId || cityId
        let idx = cityIndex
        for (let i = 0; i < CITIES.length; i++) {
          if (CITIES[i][0] === nextCity) {
            idx = i
            break
          }
        }
        session.patchAuth({
          displayName: name,
          cityId: CITIES[idx][0],
          role: body.role || auth.role,
        })
        this.setData({
          displayName: name,
          draftName: name,
          roleLabel: (body.role || auth.role) === "coach" ? "教练" : "球员",
          cityIndex: idx,
          cityId: CITIES[idx][0],
          cityLabel: CITIES[idx][1],
        })
      })
      .catch((err) => {
        if (err && err.code === "auth_invalid") {
          session.clearAuth()
          wx.redirectTo({ url: "/pages/login/login" })
        }
      })
  },
  onName(e) {
    this.setData({ draftName: e.detail.value || "" })
  },
  onSaveName() {
    const auth = session.auth()
    const name = String(this.data.draftName || "").trim()
    if (!auth || !auth.token || !name) return
    this.setData({ savingName: true, nameNote: "" })
    api
      .updateProfile(auth.token, { displayName: name })
      .then((res) => {
        const displayName = (res && res.displayName) || name
        session.patchAuth({ displayName })
        this.setData({
          savingName: false,
          displayName,
          draftName: displayName,
          nameNote: "已保存显示名",
        })
      })
      .catch((err) => {
        this.setData({
          savingName: false,
          nameNote: (err && err.detail) || "保存失败",
        })
      })
  },
  onCity(e) {
    const i = Number(e.detail.value || 0)
    const city = CITIES[i] || CITIES[7]
    this.setData({
      cityIndex: i,
      cityId: city[0],
      cityLabel: city[1],
      cityNote: "",
    })
    const auth = session.auth()
    if (!auth || !auth.token) return
    api
      .updateProfile(auth.token, { cityId: city[0] })
      .then(() => {
        session.patchAuth({ cityId: city[0] })
        this.setData({ cityNote: "所在地已更新" })
      })
      .catch((err) => {
        this.setData({ cityNote: (err && err.detail) || "城市保存失败" })
      })
  },
  goAnalysis() {
    wx.switchTab({ url: "/pages/analysis/analysis" })
  },
  goCoach() {
    wx.switchTab({ url: "/pages/coach/coach" })
  },
  goLibrary() {
    wx.navigateTo({ url: "/pages/coach-library/coach-library" })
  },
  onLogout() {
    session.clearAuth()
    wx.redirectTo({ url: "/pages/login/login" })
  },
})
