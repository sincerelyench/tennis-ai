#!/usr/bin/env bash
# Apply coach specialty + chip-near-input layout on /opt/tennis-ai
# Does NOT touch friends-view.tsx or feature-flags.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-specialty-input-layout-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  components/coach-view.tsx \
  components/coach-picker.tsx \
  components/coach-chat-personas.tsx
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (coach-specialty-input-layout)"
mkdir -p "$ROOT/components" "$ROOT/public"

cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-picker.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-chat-personas.tsx" "$ROOT/components/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-specialty-input-layout.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/coach-specialty-input-layout.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/COACH-SPECIALTY-INPUT-LAYOUT-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-SPECIALTY-INPUT-LAYOUT-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'coach-specialty-input-layout.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "coach-specialty-input-layout.html" in text:
    raise SystemExit(0)
for marker in (
    "location = /hide-empty-video-guidance.html",
    "location = /ai-coach-label.html",
    "location = /yueqiu-scored-success.html",
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
    location = /coach-specialty-input-layout.html {
        alias /var/www/apk/coach-specialty-input-layout.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted coach-specialty-input-layout.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> chown + build + restart"
chown -R tennis:tennis \
  "$ROOT/components/coach-view.tsx" \
  "$ROOT/components/coach-picker.tsx" \
  "$ROOT/components/coach-chat-personas.tsx" \
  2>/dev/null || true

cd "$ROOT"
sudo -u tennis -H bash -lc 'npx next build --webpack'
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai
echo "Done. backup=$BACKUP"
