import { cookies } from "next/headers";
import { getSession, listDirectoryUsers, sessionCookie } from "@/lib/auth-store";
import { bearerToken, json, preflight } from "@/lib/auth-http";
import type { UserRole } from "@/lib/role";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/friends/directory
 * Real logged-in users with a non-empty displayName.
 * Query: role=player|coach|any, cityId=, includeSelf=0|1
 * When none → { users: [], count: 0 } — never invents demo names.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = bearerToken(request) || jar.get(sessionCookie)?.value || "";
  const session = getSession(token);
  if (!session) return json(request, { error: "Please sign in" }, 401);

  const url = new URL(request.url);
  const roleParam = (url.searchParams.get("role") || "player").toLowerCase();
  const role: UserRole | "any" =
    roleParam === "coach" || roleParam === "player" || roleParam === "any"
      ? (roleParam as UserRole | "any")
      : "player";
  const cityId = url.searchParams.get("cityId");
  const includeSelf = url.searchParams.get("includeSelf") === "1";

  const users = listDirectoryUsers({
    role,
    cityId,
    excludePhone: includeSelf ? null : session.phone,
  }).map((u) => ({
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    cityId: u.cityId,
    level: u.level,
  }));

  return json(request, {
    ok: true,
    users,
    count: users.length,
    empty: users.length === 0,
    self: {
      phone: session.phone,
      displayName: session.displayName || "",
      role: session.role,
      cityId: session.cityId || "",
      level: session.level,
    },
  });
}
