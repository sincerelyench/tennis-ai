import type { UserRole } from "@/lib/role";

export const COACH_HOME = "/students";

export function destForRole(role: UserRole | undefined, nextPath: string) {
  if (role !== "coach") return nextPath;
  if (
    nextPath === "/" ||
    nextPath.startsWith("/analysis") ||
    nextPath.startsWith("/friends") ||
    nextPath.startsWith("/ladder") ||
    nextPath === "/coach" ||
    nextPath.startsWith("/coach/") ||
    nextPath.startsWith("/reports")
  ) {
    return COACH_HOME;
  }
  return nextPath;
}
