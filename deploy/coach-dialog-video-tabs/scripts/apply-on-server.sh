#!/usr/bin/env bash
# Apply: 教练页头部 AI教练+真实网络教练；子 tab 对话指导/视频指导；对话附小红书B站或YouTube
# Does NOT touch lib/feature-flags.ts (analysis tab stays hidden).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-dialog-video-tabs-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  components/coach-view.tsx \
  components/coach-chat-personas.tsx \
  components/coach-picker.tsx \
  components/coach-video-upload.tsx \
  components/coach-inbox-view.tsx \
  components/coach-students-view.tsx \
  lib/coach-video-guidance.ts \
  lib/coach.ts \
  lib/eight-techniques.ts \
  lib/network-coach-board.ts \
  lib/i18n/messages.ts \
  app/api/coach/chat/route.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (coach dialog + video tabs)"
mkdir -p \
  "$ROOT/lib" \
  "$ROOT/lib/i18n" \
  "$ROOT/components" \
  "$ROOT/public" \
  "$ROOT/app/api/coach/chat"

cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-chat-personas.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-picker.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-video-upload.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-inbox-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-students-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/coach-video-guidance.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/coach.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/eight-techniques.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/network-coach-board.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/chat/route.ts" "$ROOT/app/api/coach/chat/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-dialog-video-tabs.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/coach-dialog-video-tabs.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/COACH-DIALOG-VIDEO-TABS-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-DIALOG-VIDEO-TABS-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'coach-dialog-video-tabs.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "coach-dialog-video-tabs.html" in text:
    raise SystemExit(0)
marker = "location = /coach-pick-then-chinese.html"
idx = text.find(marker)
if idx < 0:
    marker = "location = /coach-dual-subtabs.html"
    idx = text.find(marker)
if idx < 0:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /coach-dialog-video-tabs.html {
        alias /var/www/apk/coach-dialog-video-tabs.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted coach-dialog-video-tabs.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next app"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/components/coach-view.tsx" \
    "$ROOT/components/coach-chat-personas.tsx" \
    "$ROOT/components/coach-picker.tsx" \
    "$ROOT/components/coach-video-upload.tsx" \
    "$ROOT/components/coach-inbox-view.tsx" \
    "$ROOT/components/coach-students-view.tsx" \
    "$ROOT/lib/coach-video-guidance.ts" \
    "$ROOT/lib/coach.ts" \
    "$ROOT/lib/eight-techniques.ts" \
    "$ROOT/lib/network-coach-board.ts" \
    "$ROOT/lib/i18n/messages.ts" \
    "$ROOT/app/api/coach/chat/route.ts" 2>/dev/null || true
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
echo "DONE coach-dialog-video-tabs apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/coach-dialog-video-tabs.html"
echo "Backup: $BACKUP"
echo "NOTE: feature-flags SHOW_ANALYSIS_TAB left untouched."
