#!/usr/bin/env bash
# Apply ZQ-137: new-user onboarding 4 selling points (涨球)
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.onboarding-4-points-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/lib"

for f in lib/i18n/messages.ts lib/messages.ts; do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install opt-patch (onboarding 4 points)"
mkdir -p "$ROOT/lib/i18n" "$ROOT/lib" "$ROOT/public" /var/www/apk

cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
if [[ -f "$PATCH_DIR/opt-patch/lib/messages.ts" ]]; then
  cp -a "$PATCH_DIR/opt-patch/lib/messages.ts" "$ROOT/lib/messages.ts"
fi

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/onboarding-4-points.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/onboarding-4-points.html 2>/dev/null || true
  chmod 644 /var/www/apk/onboarding-4-points.html 2>/dev/null || true
fi

cat > /var/www/apk/ONBOARDING-4-POINTS-NOTE.txt <<EOF
ZQ-137 onboarding-4-points
Applied: $STAMP
Web: /opt/tennis-ai lib/i18n/messages.ts + lib/messages.ts onboard.* (4 selling points)
APK / IPA: WebView → https://yqchen.blog/tennis (no native rebuild for copy-only)
mp-weixin: shooting-guide pages unchanged; product intro is web Onboarding modal

zh 1–4:
1. 一起涨球
2. 约到水平相当的球友
3. 赛后看排名变化
4. AI 教练与真实网络教练
EOF
chmod 644 /var/www/apk/ONBOARDING-4-POINTS-NOTE.txt || true
cp -a /var/www/apk/ONBOARDING-4-POINTS-NOTE.txt \
  "$PATCH_DIR/mp-patch/ONBOARDING-4-POINTS-NOTE.txt" 2>/dev/null || true

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'onboarding-4-points.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "onboarding-4-points.html" in text:
    raise SystemExit(0)
markers = [
    "location = /onboarding-intro-copy.html",
    "location = /yueqiu-scored-success.html",
    "location = /web-no-wechat-login.html",
    "location = /coach-pick-then-chinese.html",
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
    location = /onboarding-4-points.html {
        alias /var/www/apk/onboarding-4-points.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted onboarding-4-points.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Sanity: new onboard keys"
grep -n '一起涨球' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n '约到水平相当的球友' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n '赛后看排名变化' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n 'AI 教练与真实网络教练' "$ROOT/lib/i18n/messages.ts" | head -5
! grep -n '先选技术动作' "$ROOT/lib/i18n/messages.ts" || {
  echo "ERROR: old onboard copy still present" >&2
  exit 1
}

echo "==> Build Next app (before restart)"
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
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
curl -sf -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:43127/tennis/login || true
echo "DONE apply onboarding-4-points (backup $BACKUP)"
