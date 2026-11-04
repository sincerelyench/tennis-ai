const packs = {
  "zh-CN": require("../i18n/zh-CN.js"),
  en: require("../i18n/en.js"),
}

const STORAGE = "zq_lang"

function getLang() {
  try {
    return wx.getStorageSync(STORAGE) === "en" ? "en" : "zh-CN"
  } catch (e) {
    return "zh-CN"
  }
}

function setLang(lang) {
  const next = lang === "en" ? "en" : "zh-CN"
  wx.setStorageSync(STORAGE, next)
  return next
}

function pack(lang) {
  return packs[lang] || packs["zh-CN"]
}

function lookup(lang, path) {
  const parts = String(path).split(".")
  let cur = pack(lang)
  for (let i = 0; i < parts.length; i += 1) {
    if (!cur || typeof cur !== "object") return ""
    cur = cur[parts[i]]
  }
  return typeof cur === "string" ? cur : ""
}

function format(lang, path, vars) {
  let text = lookup(lang, path)
  const data = vars || {}
  Object.keys(data).forEach((key) => {
    text = text.split("{{" + key + "}}").join(String(data[key]))
  })
  return text
}

module.exports = { getLang, setLang, pack, lookup, format }
