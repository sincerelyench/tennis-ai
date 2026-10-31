/** Compact demo match builder for 涨球 mp-weixin (mirrors web match-demo). */

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tennisScore(a, b) {
  const labels = ["0", "15", "30", "40"]
  if (a >= 3 && b >= 3) {
    if (a === b) return "40-40"
    if (a === b + 1) return "Ad-40"
    if (b === a + 1) return "40-Ad"
  }
  return labels[Math.min(a, 3)] + "-" + labels[Math.min(b, 3)]
}

function buildDemoMatch(opts) {
  opts = opts || {}
  const format = opts.format || "singles"
  const mode = opts.mode || "standard"
  const rand = mulberry32(opts.seed || 20261101)
  const points = []
  let t = 2
  let gamesYou = 0
  let gamesOpp = 0
  let ptsYou = 0
  let ptsOpp = 0
  let pointIndex = 0
  const heat = []
  for (let i = 0; i < 8; i++) heat.push([0, 0, 0, 0])

  while ((gamesYou < 6 && gamesOpp < 6) || Math.abs(gamesYou - gamesOpp) < 2) {
    if (gamesYou >= 6 && gamesOpp >= 6 && Math.abs(gamesYou - gamesOpp) >= 2) break
    if (gamesYou === 7 || gamesOpp === 7 || pointIndex > 400) break
    if (rand() < 0.15) {
      const deadLen = 4 + Math.floor(rand() * 5)
      points.push({
        id: "dead-" + pointIndex,
        index: pointIndex++,
        start: t,
        end: t + deadLen,
        scoreBefore: tennisScore(ptsYou, ptsOpp),
        scoreAfter: tennisScore(ptsYou, ptsOpp),
        setScore: gamesYou + "-" + gamesOpp,
        result: "forced_error",
        winner: "you",
        rallyLength: 0,
        server: "you",
        shots: [],
        dead: true,
      })
      t += deadLen
    }
    const server = (gamesYou + gamesOpp) % 2 === 0 ? "you" : "opp"
    const rally = 1 + Math.floor(rand() * 8)
    const shots = []
    const start = t
    for (let s = 0; s < rally; s++) {
      const stroke = s === 0 ? "serve" : ["forehand", "backhand", "volley"][Math.floor(rand() * 3)]
      const side = s % 2 === 0 ? server : server === "you" ? "opp" : "you"
      const endX = 0.15 + rand() * 0.7
      const y0 = side === "you" ? 0.95 : 0.05
      const y1 = side === "you" ? 0.05 : 0.95
      const x0 = 0.32 + rand() * 0.36
      const dur = 0.8 + rand() * 0.7
      const path = []
      for (let i = 0; i <= 10; i++) {
        const u = i / 10
        path.push({ x: x0 + (endX - x0) * u, y: y0 + (y1 - y0) * u })
      }
      const end = path[path.length - 1]
      heat[Math.min(7, Math.floor(end.x * 8))][Math.min(3, Math.floor(end.y * 4))] += 1
      shots.push({
        id: "s-" + pointIndex + "-" + s,
        t: t,
        end: t + dur,
        stroke: stroke,
        side: side,
        shotIndex: s + 1,
        speedKmh: Math.round(stroke === "serve" ? 130 + rand() * 40 : 60 + rand() * 55),
        depth: Math.round((0.4 + rand() * 0.5) * 100) / 100,
        accuracy: Math.round((0.45 + rand() * 0.5) * 100) / 100,
        in: rand() > 0.12,
        x: end.x,
        y: end.y,
        ballPath: path,
      })
      t += dur
    }
    const end = t + 0.3
    const results = ["winner", "forced_error", "unforced_error", "ace", "double_fault"]
    const result = results[Math.floor(rand() * results.length)]
    let winner = rand() > 0.5 ? "you" : "opp"
    if (result === "ace") winner = server
    if (result === "double_fault") winner = server === "you" ? "opp" : "you"
    const scoreBefore = tennisScore(ptsYou, ptsOpp)
    if (winner === "you") ptsYou += 1
    else ptsOpp += 1
    const gameOver = (ptsYou >= 4 || ptsOpp >= 4) && Math.abs(ptsYou - ptsOpp) >= 2
    if (gameOver) {
      if (ptsYou > ptsOpp) gamesYou += 1
      else gamesOpp += 1
      ptsYou = 0
      ptsOpp = 0
    }
    points.push({
      id: "p-" + pointIndex,
      index: pointIndex++,
      start: start,
      end: end,
      scoreBefore: scoreBefore,
      scoreAfter: gameOver ? "0-0" : tennisScore(ptsYou, ptsOpp),
      setScore: gamesYou + "-" + gamesOpp,
      result: result,
      winner: winner,
      rallyLength: rally,
      server: server,
      shots: shots,
      lineCall: rand() > 0.5 ? { call: rand() > 0.7 ? "out" : "in", confidence: 0.7 + rand() * 0.25, note: "best-effort demo" } : null,
    })
    t = end + 1.5
  }

  const live = points.filter((p) => !p.dead)
  const youShots = live.flatMap((p) => p.shots.filter((s) => s.side === "you"))
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const first = live[0] || points[0]
  return {
    id: "m-" + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    title: opts.title || "周末练习赛",
    format: format,
    mode: mode,
    durationSec: Math.round(t),
    players: format === "doubles" ? { you: "你", opp: "对手A", youPartner: "搭档", oppPartner: "对手B" } : { you: "你", opp: "对手" },
    finalScore: gamesYou + "-" + gamesOpp,
    points: points,
    stats: {
      avgSpeedKmh: Math.round(avg(youShots.map((s) => s.speedKmh))),
      maxSpeedKmh: Math.round(Math.max.apply(null, youShots.map((s) => s.speedKmh).concat([0]))),
      avgDepth: Math.round(avg(youShots.map((s) => s.depth)) * 100) / 100,
      avgAccuracy: Math.round(avg(youShots.map((s) => s.accuracy)) * 100) / 100,
      avgRally: Math.round(avg(live.map((p) => p.rallyLength)) * 10) / 10,
      winners: live.filter((p) => p.result === "winner" && p.winner === "you").length,
      unforced: live.filter((p) => p.result === "unforced_error" && p.winner === "opp").length,
      aces: live.filter((p) => p.result === "ace" && p.winner === "you").length,
      firstServePct: Math.round(58 + rand() * 25),
      heatmap: heat,
    },
    coaching: [
      {
        id: "c1",
        kind: "serve",
        title: "发球落点偏中路",
        titleEn: "Serve too central",
        body: "一发多落中线，外角压迫不足。",
        bodyEn: "First serves crowd the T; widen the out-wide targets.",
        jumpPointId: first.id,
      },
      {
        id: "c2",
        kind: "weak",
        title: "反手非受迫偏多",
        titleEn: "Backhand UFE spike",
        body: "快节奏时反手下网，优先打深过渡。",
        bodyEn: "Backhand dumps under pace; prefer deep safety.",
        jumpPointId: (live.find((p) => p.result === "unforced_error") || first).id,
      },
    ],
    videoLabel: mode === "ground" ? "竖屏球心演示" : "比赛录像演示",
    pipeline: "demo",
    speedDisclaimer: "球速为估测值，误差约 ±10%。",
    watchNote: "",
  }
}

function filterPoints(match, filters) {
  filters = filters || {}
  return (match.points || []).filter((p) => {
    if (p.dead || !p.rallyLength) return false
    if (filters.minRally && p.rallyLength < filters.minRally) return false
    if (filters.result && filters.result !== "all" && p.result !== filters.result) return false
    if (filters.stroke && filters.stroke !== "all") {
      if (!(p.shots || []).some((s) => s.side === "you" && s.stroke === filters.stroke)) return false
    }
    return true
  })
}

module.exports = { buildDemoMatch, filterPoints }
