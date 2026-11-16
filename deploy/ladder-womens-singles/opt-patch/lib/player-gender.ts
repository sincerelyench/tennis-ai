/**
 * Gender for 女单 ladder filtering.
 *
 * Primary signal: optional self-report `AuthUser.gender` ("female" | "male").
 * Fallback (code-only, does NOT write prod DB): known seed women display names
 * from product preferences — 陈燕青、Ivy、Shirley.
 *
 * Never invent gender for arbitrary names; never backfill Postgres without 燕青 OK.
 */

export type PlayerGender = "female" | "male";

/** Normalize profile / API gender values. */
export function sanitizeGender(raw: unknown): PlayerGender | undefined {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "female" || v === "f" || v === "女" || v === "女单") return "female";
  if (v === "male" || v === "m" || v === "男") return "male";
  return undefined;
}

/**
 * Known women when `gender` is unset — seed/demo names only (preferences).
 * Match is case-insensitive on Latin names; exact on 陈燕青.
 */
const FEMALE_DISPLAY_NAME_ALLOWLIST = new Set(
  ["陈燕青", "ivy", "shirley"].map((s) => s.toLowerCase()),
);

export function isFemaleDisplayName(displayName: string | null | undefined): boolean {
  const name = String(displayName || "").trim();
  if (!name) return false;
  return FEMALE_DISPLAY_NAME_ALLOWLIST.has(name.toLowerCase());
}

/**
 * True when the player should appear on 女单.
 * Self-report female wins; self-report male excludes; else allowlist fallback.
 */
export function isFemalePlayer(opts: {
  gender?: string | null;
  displayName?: string | null;
}): boolean {
  const g = sanitizeGender(opts.gender);
  if (g === "female") return true;
  if (g === "male") return false;
  return isFemaleDisplayName(opts.displayName);
}
