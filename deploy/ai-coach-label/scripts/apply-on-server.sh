#!/usr/bin/env bash
# Apply ZQ-79: AI coach display name + hide AI bio/level
# Does NOT touch friends-view.tsx or lib/feature-flags.ts.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ai-coach-label-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  components/coach-picker.tsx \
  components/coach-video-upload.tsx \
  lib/coach-publish.ts \
  lib/i18n/messages.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (ai-coach-label)"
mkdir -p \
  "$ROOT/lib" \
  "$ROOT/lib/i18n" \
  "$ROOT/components" \
  "$ROOT/public"

cp -a "$PATCH_DIR/opt-patch/components/coach-picker.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-video-upload.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/coach-publish.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/ai-coach-label.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/ai-coach-label.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/AI-COACH-LABEL-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/AI-COACH-LABEL-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'ai-coach-label.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "ai-coach-label.html" in text:
    raise SystemExit(0)
for marker in (
    "location = /coach-dialog-video-tabs.html",
    "location = /coach-pick-then-chinese.html",
    "location = /yueqiu-my-and-ladder.html",
):
    idx = text.find(marker)
    if idx >= 0:
        break
else:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /ai-coach-label.html {
        alias /var/www/apk/ai-coach-label.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted ai-coach-label.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next app"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/components/coach-picker.tsx" \
    "$ROOT/components/coach-video-upload.tsx" \
    "$ROOT/lib/coach-publish.ts" \
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
echo "DONE ai-coach-label apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/ai-coach-label.html"
echo "Backup: $BACKUP"
echo "NOTE: friends-view.tsx and SHOW_ANALYSIS_TAB left untouched."
