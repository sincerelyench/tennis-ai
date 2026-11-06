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

function abortError(started: number, timeoutMs: number): Error {
  const elapsed = Date.now() - started;
  // Our timer only fires at timeoutMs. Earlier aborts = tab hide / refresh / WebView kill.
  if (elapsed + 250 < timeoutMs) {
    return new Error("error.uploadAborted");
  }
  return new Error("error.serviceTimeout");
}

/**
 * Upload with byte progress. fetch() cannot report upload %, so phones look
 * stuck at 2% during the long POST; XHR upload.onprogress drives the UI.
 */
export function taiUpload(
  path: string,
  body: FormData,
  init?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onProgress?: (loaded: number, total: number) => void;
  },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 900_000;
  const started = Date.now();
  const url = taiUrl(path);

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const ok = (response: Response) => {
      if (settled) return;
      settled = true;
      resolve(response);
    };

    const timer = setTimeout(() => {
      xhr.abort();
      fail(new Error("error.serviceTimeout"));
    }, timeoutMs);

    const onOuter = () => {
      xhr.abort();
      fail(abortError(started, timeoutMs));
    };
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) {
        clearTimeout(timer);
        fail(abortError(started, timeoutMs));
        return;
      }
      outer.addEventListener("abort", onOuter, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !init?.onProgress) return;
      init.onProgress(event.loaded, event.total);
    };

    xhr.onerror = () => {
      clearTimeout(timer);
      if (outer) outer.removeEventListener("abort", onOuter);
      fail(new Error("error.networkDropped"));
    };
    xhr.onabort = () => {
      clearTimeout(timer);
      if (outer) outer.removeEventListener("abort", onOuter);
      // timeout path already rejected; outer abort also rejects in onOuter
      if (!settled) fail(abortError(started, timeoutMs));
    };
    xhr.onload = () => {
      clearTimeout(timer);
      if (outer) outer.removeEventListener("abort", onOuter);
      const headers = new Headers();
      const raw = xhr.getAllResponseHeaders();
      raw
        .trim()
        .split(/[\r\n]+/)
        .forEach((line) => {
          const idx = line.indexOf(":");
          if (idx > 0) headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
        });
      ok(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers,
        }),
      );
    };

    try {
      xhr.open("POST", url);
      xhr.withCredentials = false;
      xhr.send(body);
    } catch (error) {
      clearTimeout(timer);
      if (outer) outer.removeEventListener("abort", onOuter);
      fail(error instanceof Error ? error : new Error("error.networkDropped"));
    }
  });
}

/** TAI treats a 涨球 Bearer as auth_invalid (401). Never send tennis cookies or Authorization. */
export async function taiFetch(path: string, init?: RequestInit & { timeoutMs?: number }) {
  const ctrl = new AbortController();
  const timeoutMs = init?.timeoutMs ?? 900_000;
  const started = Date.now();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = new Headers(init?.headers || {});
  headers.delete("Authorization");
  // If caller passed a signal, abort ours when theirs fires (page nav / unmount).
  const outer = init?.signal;
  const onOuter = () => ctrl.abort();
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  try {
    return await fetch(taiUrl(path), {
      ...init,
      headers,
      credentials: "omit",
      signal: ctrl.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw abortError(started, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener("abort", onOuter);
  }
}
