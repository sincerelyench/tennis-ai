#!/usr/bin/env bash
# Fix analyze stuck-at-2% fallout: page auth gate after login + re-assert #55 nginx.
# Run on 8.216.53.29 as root.
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.analyze-stuck-2pct-backup-${STAMP}"

if [[ ! -d "$ROOT" || ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai root: $ROOT" >&2
  exit 1
fi

echo "== diagnose (before) =="
bash "$HERE/scripts/diagnose-on-server.sh" "$ROOT" | tee "/tmp/analyze-stuck-2pct-before-${STAMP}.log"

mkdir -p "$BACKUP"

# 1) Patch any App Router layout/page that redirects to login when getSession(cookies()) is null.
#    Prefer trusting middleware cookie presence for HTML; keep getSession for APIs.
echo
echo "== patch layout auth redirects =="
mapfile -t LAYOUTS < <(rg -l "getSession|redirect\(.*login" "$ROOT/app" -g '*.tsx' -g '*.ts' 2>/dev/null || true)
if [[ ${#LAYOUTS[@]} -eq 0 ]]; then
  echo "WARNING: no layout/page getSession redirect found under $ROOT/app"
  echo "Listing app tree heads:" 
  find "$ROOT/app" -maxdepth 3 -type f -name '*.tsx' | head -40 || true
else
  for f in "${LAYOUTS[@]}"; do
    rel="${f#"$ROOT"/}"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$f" "$BACKUP/$rel"
    echo "  backup $rel"
  done
  # Inject force-dynamic + cookie header fallback helper next to auth-store consumers.
  HELPER="$ROOT/lib/session-from-request.ts"
  if [[ ! -f "$HELPER" ]]; then
    cat > "$HELPER" <<'TS'
import { cookies, headers } from "next/headers";
import { getSession, sessionCookie } from "@/lib/auth-store";

/** Read session token from Next cookies() or raw Cookie header (basePath-safe). */
export async function readSessionToken() {
  try {
    const jar = await cookies();
    const fromJar = jar.get(sessionCookie)?.value;
    if (fromJar) return fromJar;
  } catch {
    /* cookies() unavailable in some contexts */
  }
  try {
    const h = await headers();
    const raw = h.get("cookie") || "";
    const re = new RegExp(`(?:^|;\\s*)${sessionCookie}=([^;]+)`);
    const m = raw.match(re);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }
  return "";
}

export async function requirePageSession() {
  const token = await readSessionToken();
  return getSession(token);
}
TS
    chown tennis:tennis "$HELPER" 2>/dev/null || true
    echo "  + $HELPER"
  fi

  python3 - <<'PY' "$ROOT" "${LAYOUTS[@]}"
import pathlib, re, sys
root = pathlib.Path(sys.argv[1])
files = [pathlib.Path(p) for p in sys.argv[2:]]
for path in files:
    text = path.read_text()
    orig = text
    if "force-dynamic" not in text and ("getSession" in text or "redirect" in text):
        text = 'export const dynamic = "force-dynamic";\n' + text
    # Prefer requirePageSession when getSession(cookies()) pattern exists
    if "requirePageSession" not in text and "getSession" in text:
        if 'from "@/lib/session-from-request"' not in text and "session-from-request" not in text:
            text = text.replace(
                'from "@/lib/auth-store"',
                'from "@/lib/auth-store"\nimport { requirePageSession, readSessionToken } from "@/lib/session-from-request"',
                1,
            )
        # Common patterns
        text = re.sub(
            r'getSession\(\s*\(await cookies\(\)\)\.get\([^)]+\)\?\.value\s*\)',
            "await requirePageSession()",
            text,
        )
        text = re.sub(
            r'getSession\(\s*cookies\(\)[\s\S]{0,80}?\)',
            "await requirePageSession()",
            text,
            count=3,
        )
    if text != orig:
        path.write_text(text)
        print(f"  patched {path}")
    else:
        print(f"  no auto-patch applied for {path} (manual review)")
PY
fi

# 2) Login hard navigation — avoid soft push + refresh bouncing off a bad RSC gate
LOGIN="$ROOT/components/login-view.tsx"
if [[ -f "$LOGIN" ]]; then
  mkdir -p "$BACKUP/components"
  cp -a "$LOGIN" "$BACKUP/components/login-view.tsx"
  python3 - <<'PY' "$LOGIN"
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
orig = text
# After successful login, prefer hard navigation so Set-Cookie is definitely sent on next document request.
if "window.location.assign" not in text and "router.push(destForRole" in text:
    text = text.replace(
        "router.push(destForRole(data.role, nextPath));\n        router.refresh();",
        'const dest = destForRole(data.role, nextPath);\n        if (typeof window !== "undefined") {\n          window.location.assign(`/tennis${dest.startsWith("/") ? dest : `/${dest}`}`);\n          return;\n        }\n        router.push(dest);\n        router.refresh();',
    )
    text = text.replace(
        "router.push(destForRole(data.role, nextPath));\n      router.refresh();",
        'const dest = destForRole(data.role, nextPath);\n      if (typeof window !== "undefined") {\n        window.location.assign(`/tennis${dest.startsWith("/") ? dest : `/${dest}`}`);\n        return;\n      }\n      router.push(dest);\n      router.refresh();',
    )
if text != orig:
    path.write_text(text)
    print("  patched login-view hard navigation")
else:
    print("  login-view: no hard-nav patch matched (check manually)")
PY
  chown tennis:tennis "$LOGIN" 2>/dev/null || true
fi

# 3) Re-assert nginx /tai streaming from hotfix #55
TAI_SNIPPET=/etc/nginx/snippets/yqchen-tai.conf
if [[ -f "$HERE/../analyze-trim-hotfix/yqchen-tai.conf" ]]; then
  SRC="$HERE/../analyze-trim-hotfix/yqchen-tai.conf"
elif [[ -f "$HERE/yqchen-tai.conf" ]]; then
  SRC="$HERE/yqchen-tai.conf"
else
  SRC=""
fi
if [[ -n "$SRC" ]]; then
  cp -a "$TAI_SNIPPET" "$BACKUP/yqchen-tai.conf.bak" 2>/dev/null || true
  install -D -m 0644 "$SRC" "$TAI_SNIPPET"
  nginx -t
  systemctl reload nginx
  echo "  nginx tai snippet refreshed + reloaded"
else
  echo "  (no yqchen-tai.conf in package; checking live buffering)"
  rg -n "proxy_request_buffering" /etc/nginx/snippets/yqchen-tai.conf || echo "  WARNING: buffering directive missing"
fi

# 4) Build + restart
echo
echo "== next build + restart =="
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  su -s /bin/bash tennis -c "cd '$ROOT' && npm run build"
else
  npm run build
fi
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai

echo
echo "== diagnose (after) =="
bash "$HERE/scripts/diagnose-on-server.sh" "$ROOT" | tee "/tmp/analyze-stuck-2pct-after-${STAMP}.log"

echo
echo "DONE backup=$BACKUP"
echo "Expect: login cookie + GET https://yqchen.blog/tennis/analysis -> 200 (not 307 login)"
