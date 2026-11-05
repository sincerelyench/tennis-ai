/** Live analysis FastAPI. Clips go here directly instead of through Next. */
export const TAI_ORIGIN = "https://yqchen.blog/tai";

export function taiUrl(path: string) {
  return `${TAI_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const ANALYZE_POLL_MS = 400;
export const ANALYZE_POLL_TRIES = 900;

export type TaiHealth = {
  ok: boolean;
  busy: boolean;
  busyJob?: { id?: string; progress?: number; message?: string; step_name?: string } | null;
};

export async function pingTai(): Promise<TaiHealth> {
  const response = await taiFetch("/api/health", { timeoutMs: 8_000 });
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    busy?: boolean;
    busy_job?: TaiHealth["busyJob"];
  } | null;
  return {
    ok: Boolean(response.ok && data?.ok),
    busy: Boolean(data?.busy),
    busyJob: data?.busy_job ?? null,
  };
}

/** TAI treats a 涨球 Bearer as auth_invalid (401). Never send tennis cookies or Authorization. */
export async function taiFetch(path: string, init?: RequestInit & { timeoutMs?: number }) {
  const ctrl = new AbortController();
  // Match nginx /tai proxy_read_timeout (900s). Large phone clips used to abort at 180s → 499.
  const timeoutMs = init?.timeoutMs ?? 900_000;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = new Headers(init?.headers || {});
  headers.delete("Authorization");
  try {
    return await fetch(taiUrl(path), {
      ...init,
      headers,
      credentials: "omit",
      signal: ctrl.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("error.serviceTimeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
