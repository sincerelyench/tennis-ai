/**
 * Merge into lib/i18n/messages.ts (en + zh) friends block.
 * Remove or blank searchPh / searchAria; stop empty states from implying search.
 * Do not change brand 涨球 or coach 掌球教练.
 */
export const friendsMessagesPatch = {
  en: {
    empty: "No friends yet",
    emptyDesc: "No friends listed yet.",
    searchPh: "",
    searchAria: "",
    // keep: title, count, rankTitle, rankLead, singles, doubles, ladder copy, invite…
  },
  zh: {
    empty: "还没有球友",
    emptyDesc: "这一带暂时没有球友。",
    searchPh: "",
    searchAria: "",
  },
} as const;
