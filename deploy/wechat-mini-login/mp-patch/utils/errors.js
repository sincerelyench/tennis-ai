const i18n = require("./i18n")

function message(lang, err) {
  const code = err && err.code ? err.code : "generic"
  const localized = i18n.lookup(lang, "errors." + code)
  if (localized) return localized
  if (lang === "zh-CN" && err && err.detail) return err.detail
  return i18n.lookup(lang, "errors.generic")
}

module.exports = { message }
