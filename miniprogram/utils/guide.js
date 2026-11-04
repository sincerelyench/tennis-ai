const KEYS = ["side", "full_body", "racket"]

function completed(checks) {
  return KEYS.every((key) => !!(checks && checks[key]))
}

function count(checks) {
  return KEYS.filter((key) => checks && checks[key]).length
}

function items(copy, checks) {
  return ((copy && copy.guide && copy.guide.items) || []).map((item) => ({
    key: item.key,
    title: item.title,
    desc: item.desc,
    on: !!(checks && checks[item.key]),
  }))
}

module.exports = { KEYS, completed, count, items }
