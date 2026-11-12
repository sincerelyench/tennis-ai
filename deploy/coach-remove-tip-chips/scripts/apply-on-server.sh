#!/usr/bin/env bash
# Remove coach tip-chip selector (点选要点 / 正手·发球·反手). Keep specialty blurbs.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-remove-tip-chips-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components"
cp -a "$ROOT/components/coach-view.tsx" "$BACKUP/components/"

echo "==> Install opt-patch (coach-view only)"
cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p /var/www/apk "$ROOT/public"
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-remove-tip-chips.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/coach-remove-tip-chips.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/COACH-REMOVE-TIP-CHIPS-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-REMOVE-TIP-CHIPS-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'coach-remove-tip-chips.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "coach-remove-tip-chips.html" in text:
    raise SystemExit(0)
for marker in (
    "location = /coach-specialty-input-layout.html",
    "location = /hide-empty-video-guidance.html",
    "location = /ai-coach-label.html",
):
    idx = text.find(marker)
    if idx >= 0:
        break
else:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /coach-remove-tip-chips.html {
        alias /var/www/apk/coach-remove-tip-chips.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted coach-remove-tip-chips.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

chown tennis:tennis "$ROOT/components/coach-view.tsx" 2>/dev/null || true
cd "$ROOT"
sudo -u tennis -H bash -lc 'npx next build --webpack'
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai
echo "Done. backup=$BACKUP"
