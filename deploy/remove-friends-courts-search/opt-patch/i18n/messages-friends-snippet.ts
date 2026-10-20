/**
 * Merge into lib/i18n/messages.ts (en + zh) friends block.
 * Remove or blank searchPh / searchAria; stop empty states from implying search.
 * Ladder copy uses UTR-like labels (not NTRP) — see also deploy/friends-utr/.
 * Do not change brand 涨球 or coach 掌球教练.
 */
export const friendsMessagesPatch = {
  en: {
    empty: "No friends yet",
    emptyDesc: "No friends listed yet.",
    searchPh: "",
    searchAria: "",
    rankLead:
      "Wuxi and nearby. Ranked by a UTR-like rating, updated from match results, opponent strength, and recent form.",
    seedOnly: "UTR {n} · no matches yet",
    emptyRankDesc: "After the first local match, ratings move off the UTR seed.",
    howBody:
      "Seed = self-level × 2.15 on a UTR-like scale. Each match shifts you by how surprising the result was versus that opponent. The last six weeks count more. Doubles uses the pair average and a smaller step.",
  },
  zh: {
    empty: "还没有球友",
    emptyDesc: "这一带暂时没有球友。",
    searchPh: "",
    searchAria: "",
    rankLead: "无锡及附近。按类 UTR 分数排名，再按战绩、对手强度和近期比赛浮动。",
    seedOnly: "UTR {n} · 还没有比赛",
    emptyRankDesc: "有了第一场本地比赛后，分数会离开 UTR 种子分。",
    howBody:
      "起点是自评水平 × 2.15（类 UTR）。每场按「对这个对手该不该赢」调整。近六周权重大。双打用双方平均分，步长更小。",
  },
} as const;
