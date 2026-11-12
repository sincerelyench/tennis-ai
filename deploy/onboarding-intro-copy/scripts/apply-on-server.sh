#!/usr/bin/env bash
# Apply: new-user onboarding intro copy (涨球 pitch, Yanqing wording)
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.onboarding-intro-copy-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  lib/i18n/messages.ts \
  lib/messages.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (onboarding intro copy)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/lib" "$ROOT/public" /var/www/apk

cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/"
if [[ -f "$PATCH_DIR/opt-patch/lib/messages.ts" ]]; then
  cp -a "$PATCH_DIR/opt-patch/lib/messages.ts" "$ROOT/lib/"
fi

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/onboarding-intro-copy.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/onboarding-intro-copy.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/ONBOARDING-INTRO-COPY-NOTE.txt" ]]; then
  cp -a "$PATCH_DIR/mp-patch/ONBOARDING-INTRO-COPY-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'onboarding-intro-copy.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "onboarding-intro-copy.html" in text:
    raise SystemExit(0)
markers = [
    "location = /yueqiu-scored-success.html",
    "location = /web-no-wechat-login.html",
    "location = /coach-pick-then-chinese.html",
    "location = /coach-dual-subtabs.html",
]
idx = -1
for marker in markers:
    idx = text.find(marker)
    if idx >= 0:
        break
if idx < 0:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /onboarding-intro-copy.html {
        alias /var/www/apk/onboarding-intro-copy.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted onboarding-intro-copy.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next app"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/lib/i18n/messages.ts" \
    "$ROOT/lib/messages.ts" 2>/dev/null || true
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

echo "==> Done (backup $BACKUP)"
