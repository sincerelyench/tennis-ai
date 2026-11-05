#!/usr/bin/env bash
# Hotfix blog Next.js (/opt/tennis-ai) for serve analyze timeout:
# - pingTai returns busy so submit fails fast (no multi-minute upload → AbortError)
# - FormData puts video last (small fields first)
# Run on blog host as root.
set -euo pipefail

APP="${APP:-/opt/tennis-ai}"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$APP/.analyze-timeout-serve-backup-$STAMP"
mkdir -p "$BACKUP"

cp -a "$APP/lib/tai.ts" "$BACKUP/"
cp -a "$APP/components/analysis-view.tsx" "$BACKUP/"
echo "backup → $BACKUP"

# --- lib/tai.ts ---
cat > "$APP/lib/tai.ts" <<'EOF'
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
EOF

# --- analysis-view.tsx submit: busy fail-fast + video last ---
python3 - <<'PY'
from pathlib import Path
path = Path("/opt/tennis-ai/components/analysis-view.tsx")
text = path.read_text()
old = '''    const ready = await pingTai().catch(() => false);
    if (!ready) {
      clearActiveJob();
      setPhase("error");
      setFormError(t("analysis.serviceDown"));
      return;
    }
    const body = new FormData();
    const clipName = file.name.toLowerCase().endsWith(".mp4") ? file.name : `${file.name.replace(/\\.[^.]+$/, "") || "clip"}.mp4`;
    body.append("video", file, clipName);
    body.append("level", "");
    body.append("stroke", stroke.apiStroke);
    body.append("title", analysisTitle(stroke.label, file.name));
    body.append("sample", "0");
'''
new = '''    const health = await pingTai().catch(() => ({ ok: false, busy: false }));
    if (!health.ok) {
      clearActiveJob();
      setPhase("error");
      setFormError(t("analysis.serviceDown"));
      return;
    }
    // GPU is single-worker. Uploading while busy used to wait for the whole
    // multipart body then 409 — phones abort mid-upload → error.serviceTimeout.
    if (health.busy) {
      clearActiveJob();
      setPhase("error");
      setFormError(t("error.busy"));
      return;
    }
    const body = new FormData();
    const clipName = file.name.toLowerCase().endsWith(".mp4") ? file.name : `${file.name.replace(/\\.[^.]+$/, "") || "clip"}.mp4`;
    body.append("level", "");
    body.append("stroke", stroke.apiStroke);
    body.append("title", analysisTitle(stroke.label, file.name));
    body.append("sample", "0");
    body.append("video", file, clipName);
'''
if old not in text:
    raise SystemExit("analysis-view submit block not found — aborting")
path.write_text(text.replace(old, new, 1))
print("analysis-view.tsx patched")
PY

chown tennis:tennis "$APP/lib/tai.ts" "$APP/components/analysis-view.tsx"

echo "== build =="
sudo -u tennis -H bash -lc "cd '$APP' && npm run build"
echo "== restart =="
systemctl restart tennis-ai.service
sleep 2
systemctl is-active tennis-ai.service
curl -sS -m 10 -o /dev/null -w "tennis_home:%{http_code}\n" https://yqchen.blog/tennis/ || true
curl -sS -m 10 https://yqchen.blog/tai/api/health | head -c 200; echo
echo "DONE apply-on-server $STAMP"
