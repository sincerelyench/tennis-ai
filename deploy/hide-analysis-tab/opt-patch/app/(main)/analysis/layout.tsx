import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PLAYER_DEFAULT_TAB, SHOW_ANALYSIS_TAB } from "@/lib/feature-flags";

/**
 * When Analysis is temporarily hidden, any /analysis deep link lands on 约球
 * so users are not stuck. Flip SHOW_ANALYSIS_TAB to restore pages in place.
 */
export default function AnalysisLayout({ children }: { children: ReactNode }) {
  if (!SHOW_ANALYSIS_TAB) {
    redirect(PLAYER_DEFAULT_TAB);
  }
  return children;
}
