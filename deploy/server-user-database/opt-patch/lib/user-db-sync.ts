/**
 * Sync bridge to Postgres for 涨球 user/session/friends stores.
 * Keeps existing sync call sites; process-local cache avoids per-read psql.
 */
import { spawnSync } from "child_process";
import path from "path";

export type UserDbKind = "auth" | "intros" | "scores";

const HELPER = path.join(process.cwd(), "scripts", "user-db-io.cjs");

function run(args: string[], input?: string) {
  const result = spawnSync(process.execPath, [HELPER, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "user-db-io failed").trim();
    throw new Error(err);
  }
  return result.stdout || "";
}

export function userDbLoad(kind: UserDbKind): unknown {
  const raw = run(["load", kind]).trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

export function userDbSave(kind: UserDbKind, data: unknown) {
  run(["save", kind], JSON.stringify(data));
}

export function userDbPing(): { ok: boolean; users?: number; detail?: string } {
  try {
    const raw = run(["ping"]).trim();
    return JSON.parse(raw) as { ok: boolean; users?: number; detail?: string };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
