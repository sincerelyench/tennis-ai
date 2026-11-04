/** 涨球 · 分析问题点 → 正确动作示范映射（小程序） */
const AXIS_LOW = { 重心: 18, 击球点: 14, 动力链: 20, 击球效果: 18 }
const AXIS_KEY = { 重心: "balance", 击球点: "contact", 动力链: "chain", 击球效果: "effect" }
const AXIS_EN = { balance: "Balance", contact: "Contact", chain: "Kinetic chain", effect: "Ball effect" }

const RULES = [
  { test: /重心|直腿|站得|头肩|weight|straight leg/i, id: "weight", axis: "重心", zh: "重心偏高 / 不稳", en: "Balance too high / unstable" },
  { test: /步幅偏窄|开立不够|站位|stance too narrow/i, id: "stance", axis: "重心", zh: "站位偏窄", en: "Stance too narrow" },
  { test: /击球点.*晚|太后|偏晚|contact late|late_contact/i, id: "late", axis: "击球点", zh: "击球点偏晚", en: "Contact late" },
  { test: /击球点.*低|contact too low|contact_low/i, id: "contact_low", axis: "击球点", zh: "击球点偏低", en: "Contact too low" },
  { test: /转肩|转髋|动力链|只动手|shoulder turn|kinetic chain/i, id: "turn", axis: "动力链", zh: "动力链断裂 / 转体不足", en: "Kinetic chain / short turn" },
  { test: /引拍|后摆偏浅|takeback/i, id: "takeback", axis: "动力链", zh: "引拍偏浅", en: "Shallow takeback" },
  { test: /拍头偏慢|速度偏慢|擦玻璃|随挥|follow-?through/i, id: "effect", axis: "击球效果", zh: "击球效果偏弱", en: "Weak ball effect" },
]

const STAR = {
  forehand: { creditZh: "萨巴伦卡 · 正手上旋", creditEn: "Sabalenka · Forehand", embed: "https://player.bilibili.com/player.html?bvid=BV1knqeB4EpG&high_quality=1&danmaku=0" },
  backhand: { creditZh: "德约科维奇 · 反手上旋", creditEn: "Djokovic · Backhand", embed: "https://player.bilibili.com/player.html?bvid=BV1Gy4y1a7zj&high_quality=1&danmaku=0" },
  serve: { creditZh: "桑普拉斯 · 发球", creditEn: "Sampras · Serve", embed: "https://player.bilibili.com/player.html?bvid=BV13t411K7Kw&high_quality=1&danmaku=0" },
}

function detectIssuePoints(findings, scores) {
  const out = []
  const seen = {}
  ;(findings || []).forEach((line) => {
    RULES.forEach((rule) => {
      if (seen[rule.id]) return
      if (!rule.test.test(String(line || ""))) return
      seen[rule.id] = true
      out.push(Object.assign({}, rule, { axisKey: AXIS_KEY[rule.axis] }))
    })
  })
  const axesHit = {}
  out.forEach((r) => { axesHit[r.axis] = true })
  Object.keys(AXIS_LOW).forEach((axis) => {
    if (axesHit[axis]) return
    const score = scores && (scores[axis] != null ? scores[axis] : scores[AXIS_KEY[axis]])
    if (typeof score !== "number" || score > AXIS_LOW[axis]) return
    const id = "axis-" + AXIS_KEY[axis]
    if (seen[id]) return
    seen[id] = true
    out.push({
      id,
      axis,
      axisKey: AXIS_KEY[axis],
      zh: axis + "偏弱",
      en: (AXIS_EN[AXIS_KEY[axis]] || axis) + " needs work",
    })
  })
  return out.slice(0, 4)
}

function demosForResult(payload, lang) {
  const findings = [].concat(payload.problems || [], payload.focus ? [payload.focus] : [])
  const scores = {}
  ;(payload.axes || []).forEach((axis) => {
    if (axis && axis.key && typeof axis.score === "number") scores[axis.key] = axis.score
  })
  // also accept zh keys if present
  if (payload.scores) Object.assign(scores, payload.scores)
  const issues = detectIssuePoints(findings, scores)
  const stroke = payload.stroke === "backhand" || payload.stroke === "serve" ? payload.stroke : "forehand"
  const star = STAR[stroke] || STAR.forehand
  const en = String(lang || "").indexOf("en") === 0
  if (!issues.length) {
    return [{
      id: "stroke",
      axisLabel: en ? "Overall" : "整体",
      label: en ? "Overall form" : "整体动作",
      credit: en ? star.creditEn : star.creditZh,
      embed: star.embed,
      state: "ready",
    }]
  }
  return issues.map((issue) => ({
    id: issue.id,
    axisLabel: en ? (AXIS_EN[issue.axisKey] || issue.axis) : issue.axis,
    label: en ? issue.en : issue.zh,
    credit: en ? star.creditEn : star.creditZh,
    embed: star.embed,
    state: "ready",
  }))
}

module.exports = { detectIssuePoints, demosForResult }
