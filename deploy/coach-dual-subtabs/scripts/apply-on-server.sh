#!/usr/bin/env bash
# Apply: 教练页「视频指导」+「改进计划」双分区
# Does NOT touch lib/feature-flags.ts (analysis tab stays hidden).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-dual-subtabs-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" "$BACKUP/public" "$BACKUP/lib"

for f in \
  components/coach-view.tsx \
  components/coach-video-upload.tsx \
  lib/coach-video-guidance.ts \
  lib/i18n/messages.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (coach dual sub-tabs)"
mkdir -p "$ROOT/lib" "$ROOT/lib/i18n" "$ROOT/components" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-video-upload.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/coach-video-guidance.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-dual-subtabs.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/coach-dual-subtabs.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/COACH-DUAL-SUBTABS-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-DUAL-SUBTABS-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

# Preview route on yqchen.blog (same pattern as match-city-before-name.html)
if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'coach-dual-subtabs.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "coach-dual-subtabs.html" in text:
    raise SystemExit(0)
marker = "location = /match-city-before-name.html"
idx = text.find(marker)
if idx < 0:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /coach-dual-subtabs.html {
        alias /var/www/apk/coach-dual-subtabs.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted coach-dual-subtabs.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next app"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/components/coach-view.tsx" \
    "$ROOT/components/coach-video-upload.tsx" \
    "$ROOT/lib/coach-video-guidance.ts" \
    "$ROOT/lib/i18n/messages.ts" 2>/dev/null || true
fi
if [[ -f package.json ]]; then
  if id tennis >/dev/null 2>&1; then
    sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true
curl -sf -o /dev/null -w "tennis_http=%{http_code}\n" http://127.0.0.1:43127/tennis || true
echo "DONE coach-dual-subtabs apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/coach-dual-subtabs.html"
echo "Backup: $BACKUP"
echo "NOTE: feature-flags SHOW_ANALYSIS_TAB left untouched."
