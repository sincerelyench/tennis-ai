/**
 * Temporary product flags. Flip these rather than deleting routes/UI.
 *
 * SHOW_ANALYSIS_TAB: bottom-nav 「分析」 + /analysis deep links.
 * Set to true to restore the Analysis tab and pages.
 *
 * Bottom nav (ZQ-143):
 * - Analysis hidden: 约球 · 排行榜 · 教练 · 我的
 * - Analysis on: 分析 · 约球 · 排行榜 · 教练 · 我的
 */
export const SHOW_ANALYSIS_TAB = false;

/** First visible player tab when Analysis is hidden (约球). */
export const PLAYER_DEFAULT_TAB = "/friends";
