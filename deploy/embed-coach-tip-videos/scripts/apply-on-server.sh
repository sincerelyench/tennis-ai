#!/usr/bin/env bash
# Apply: 对话指导内嵌可播放讲解视频；网络教练空态「无教练」；无选中时隐藏「网络教练留言」
# Does NOT touch lib/feature-flags.ts (analysis tab stays hidden).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.embed-coach-tip-videos-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  components/coach-view.tsx \
  components/coach-chat-personas.tsx \
  components/player-coach-picker.tsx \
  components/coach-select-section.tsx \
  lib/coach.ts \
  app/api/coach/chat/route.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (embed coach tip videos)"
mkdir -p \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/public" \
  "$ROOT/app/api/coach/chat"

cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-chat-personas.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/player-coach-picker.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-select-section.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/coach.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/chat/route.ts" "$ROOT/app/api/coach/chat/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/embed-coach-tip-videos.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/embed-coach-tip-videos.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/EMBED-COACH-TIP-VIDEOS-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/EMBED-COACH-TIP-VIDEOS-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'embed-coach-tip-videos.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "embed-coach-tip-videos.html" in text:
    raise SystemExit(0)
marker = "location = /coach-dialog-video-tabs.html"
idx = text.find(marker)
if idx < 0:
    marker = "location = /coach-pick-then-chinese.html"
    idx = text.find(marker)
if idx < 0:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /embed-coach-tip-videos.html {
        alias /var/www/apk/embed-coach-tip-videos.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted embed-coach-tip-videos.html location")
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
    "$ROOT/components/player-coach-picker.tsx" \
    "$ROOT/components/coach-select-section.tsx" \
    "$ROOT/lib/coach.ts" \
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
echo "DONE embed-coach-tip-videos apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/embed-coach-tip-videos.html"
echo "Backup: $BACKUP"
echo "NOTE: feature-flags SHOW_ANALYSIS_TAB left untouched."
