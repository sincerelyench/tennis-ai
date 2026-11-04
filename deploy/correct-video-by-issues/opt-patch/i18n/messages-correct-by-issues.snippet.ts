/**
 * Merge into lib/i18n/messages.ts under en.visual / zh.visual (涨球).
 *
 * en.visual additions:
 *   correctByIssuesLead: "Demos matched to your {count} problem points.",
 *   demoLoading: "Loading correct-form demos…",
 *   demoError: "Could not load issue demos. Showing the stroke star demo.",
 *
 * zh.visual additions:
 *   correctByIssuesLead: "按你这次分析的 {count} 个问题点匹配正确动作示范。",
 *   demoLoading: "正在加载正确动作示范…",
 *   demoError: "问题点示范加载失败，先看该技术的球星示范。",
 */
export const EN_VISUAL_EXTRA = {
  correctByIssuesLead: "Demos matched to your {count} problem points.",
  demoLoading: "Loading correct-form demos…",
  demoError: "Could not load issue demos. Showing the stroke star demo.",
} as const;

export const ZH_VISUAL_EXTRA = {
  correctByIssuesLead: "按你这次分析的 {count} 个问题点匹配正确动作示范。",
  demoLoading: "正在加载正确动作示范…",
  demoError: "问题点示范加载失败，先看该技术的球星示范。",
} as const;
