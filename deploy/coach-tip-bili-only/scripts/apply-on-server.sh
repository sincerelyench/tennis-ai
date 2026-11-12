#!/usr/bin/env bash
# Apply: 对话指导中文只留 B站（去掉小红书 tip 卡）；英文 YouTube；禁止 tip demo mp4
# Does NOT touch lib/feature-flags.ts (analysis tab stays hidden).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-tip-bili-only-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  components/coach-view.tsx \
  components/coach-picker.tsx \
  components/coach-tip-video.tsx \
  lib/coach.ts \
  app/api/coach/chat/route.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (coach tip bili only)"
mkdir -p \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/public" \
  "$ROOT/app/api/coach/chat"

cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-picker.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-tip-video.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/coach.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/chat/route.ts" "$ROOT/app/api/coach/chat/"

# Keep previously patched chat personas / pickers if present in this folder (optional).
if [[ -f "$PATCH_DIR/opt-patch/components/coach-chat-personas.tsx" ]]; then
  cp -a "$PATCH_DIR/opt-patch/components/coach-chat-personas.tsx" "$ROOT/components/"
fi
if [[ -f "$PATCH_DIR/opt-patch/components/player-coach-picker.tsx" ]]; then
  cp -a "$PATCH_DIR/opt-patch/components/player-coach-picker.tsx" "$ROOT/components/"
fi
if [[ -f "$PATCH_DIR/opt-patch/components/coach-select-section.tsx" ]]; then
  cp -a "$PATCH_DIR/opt-patch/components/coach-select-section.tsx" "$ROOT/components/"
fi

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-tip-bili-only.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/coach-tip-bili-only.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/COACH-TIP-BILI-ONLY-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-TIP-BILI-ONLY-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi
if [[ -f "$PATCH_DIR/mp-patch/COACH-TIP-BILI-ONLY-SYNC.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-TIP-BILI-ONLY-SYNC.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'coach-tip-bili-only.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "coach-tip-bili-only.html" in text:
    raise SystemExit(0)
for marker in (
    "location = /coach-tip-videos-real.html",
    "location = /embed-coach-tip-videos.html",
    "location = /coach-dialog-video-tabs.html",
):
    idx = text.find(marker)
    if idx >= 0:
        break
else:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /coach-tip-bili-only.html {
        alias /var/www/apk/coach-tip-bili-only.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted coach-tip-bili-only.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next app"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/components/coach-view.tsx" \
    "$ROOT/components/coach-picker.tsx" \
    "$ROOT/components/coach-tip-video.tsx" \
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
echo "DONE coach-tip-bili-only apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/coach-tip-bili-only.html"
echo "Backup: $BACKUP"
echo "NOTE: feature-flags SHOW_ANALYSIS_TAB left untouched."
