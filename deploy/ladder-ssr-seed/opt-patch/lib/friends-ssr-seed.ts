/**
 * ZQ-164d: SSR seed for ladder / 约球 so WeChat web-view first paint is not
 * permanently stuck on「无锡 暂无球员（0）」when client JS never runs refreshLadder.
 * No DB writes — read-only loopback to the same Next API the client uses.
 */
import { cookies, headers } from "next/headers";
import { sessionCookie } from "@/lib/auth-store";
import { DEFAULT_CITY_ID } from "@/lib/cities";

const LOOPBACK = "http://127.0.0.1:43127";

async function readSessionToken(): Promise<string> {
  try {
    const jar = await cookies();
    const fromJar = jar.get(sessionCookie)?.value;
    if (fromJar) return fromJar;
  } catch {
    /* cookies() can throw in rare contexts */
  }
  try {
    const raw = (await headers()).get("cookie") || "";
    const re = new RegExp(`(?:^|;\\s*)${sessionCookie}=([^;]+)`);
    const m = raw.match(re);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }
  return "";
}

async function apiGet(path: string, token: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${LOOPBACK}${path}`, {
      headers: {
        Cookie: `${sessionCookie}=${token}`,
        Host: "yqchen.blog",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export type FriendsSsrSeed = {
  cityId: string;
  ladderRows: unknown[];
  successRecords: unknown[];
};

/**
 * Prefetch singles ladder (Wuxi → unscoped fallback) + intro success list.
 * Safe to call from RSC; returns nulls/empties on any failure.
 */
export async function loadFriendsSsrSeed(
  format: "singles" | "womens_singles" = "singles",
): Promise<FriendsSsrSeed> {
  const empty: FriendsSsrSeed = {
    cityId: DEFAULT_CITY_ID,
    ladderRows: [],
    successRecords: [],
  };
  const token = await readSessionToken();
  if (!token) return empty;

  let cityId = DEFAULT_CITY_ID;
  let ladderRows: unknown[] = [];

  const q = new URLSearchParams({ format, cityId });
  const ladder = (await apiGet(`/tennis/api/friends/ladder?${q}`, token)) as {
    rows?: unknown[];
  } | null;
  if (ladder && Array.isArray(ladder.rows)) {
    ladderRows = ladder.rows;
  }
  // Mirror ZQ-163 client fallback: empty city → unscoped.
  if (ladderRows.length === 0) {
    const all = (await apiGet(
      `/tennis/api/friends/ladder?format=${encodeURIComponent(format)}`,
      token,
    )) as { rows?: unknown[] } | null;
    if (all && Array.isArray(all.rows) && all.rows.length > 0) {
      ladderRows = all.rows;
      cityId = "";
    }
  }

  let successRecords: unknown[] = [];
  const intros = (await apiGet("/tennis/api/friends/intros", token)) as {
    success?: unknown[];
  } | null;
  if (intros && Array.isArray(intros.success)) {
    successRecords = intros.success;
  }

  return { cityId: cityId || DEFAULT_CITY_ID, ladderRows, successRecords };
}
