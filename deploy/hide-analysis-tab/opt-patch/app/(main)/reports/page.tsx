import { redirect } from "next/navigation";
import { PLAYER_DEFAULT_TAB, SHOW_ANALYSIS_TAB } from "@/lib/feature-flags";

/** Legacy /reports → analysis list; when Analysis is hidden, soft-land on 约球. */
export default function ReportsPage() {
  redirect(SHOW_ANALYSIS_TAB ? "/analysis" : PLAYER_DEFAULT_TAB);
}
