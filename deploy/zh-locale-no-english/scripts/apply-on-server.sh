#!/usr/bin/env bash
# Apply: locale=zh 全站去掉残留英文；恢复被覆盖的 journey/约球/我的 i18n keys；页面标题随 tennis-locale。
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.zh-locale-no-english-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"

backup_one() {
  local f="$1"
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
}

backup_one "lib/i18n/messages.ts"
backup_one "lib/i18n/page-meta.ts"
backup_one "app/layout.tsx"
backup_one "app/login/page.tsx"
backup_one "app/(main)/page.tsx"
backup_one "app/(main)/friends/page.tsx"
backup_one "app/(main)/coach/page.tsx"
backup_one "app/(main)/notices/page.tsx"
backup_one "app/(main)/notifications/page.tsx"
backup_one "app/(main)/journey/page.tsx"
backup_one "app/(main)/help/page.tsx"
backup_one "app/(main)/inbox/page.tsx"
backup_one "app/(main)/students/page.tsx"
backup_one "app/(main)/analysis/page.tsx"
backup_one "app/(main)/analysis/new/page.tsx"
backup_one "app/(main)/report/[id]/page.tsx"
backup_one "public/zq-friends-score-inject.js"
backup_one "public/zq-friends-city-inject.js"
backup_one "public/zq-friends-matchmaking-inject.js"
backup_one "components/profile-view.tsx"
backup_one "components/journey-view.tsx"
backup_one "components/friends-view.tsx"
backup_one "lib/data.ts"

echo "==> Install opt-patch (zh locale no English)"
mkdir -p \
  "$ROOT/lib/i18n" \
  "$ROOT/app/login" \
  "$ROOT/app/(main)/friends" \
  "$ROOT/app/(main)/coach" \
  "$ROOT/app/(main)/notices" \
  "$ROOT/app/(main)/notifications" \
  "$ROOT/app/(main)/journey" \
  "$ROOT/app/(main)/help" \
  "$ROOT/app/(main)/inbox" \
  "$ROOT/app/(main)/students" \
  "$ROOT/app/(main)/analysis/new" \
  "$ROOT/app/(main)/report/[id]" \
  "$ROOT/public" \
  /var/www/apk

cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/page-meta.ts" "$ROOT/lib/i18n/"
cp -a "$PATCH_DIR/opt-patch/app/layout.tsx" "$ROOT/app/"
cp -a "$PATCH_DIR/opt-patch/app/login/page.tsx" "$ROOT/app/login/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/page.tsx" "$ROOT/app/(main)/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/friends/page.tsx" "$ROOT/app/(main)/friends/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/coach/page.tsx" "$ROOT/app/(main)/coach/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/notices/page.tsx" "$ROOT/app/(main)/notices/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/notifications/page.tsx" "$ROOT/app/(main)/notifications/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/journey/page.tsx" "$ROOT/app/(main)/journey/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/help/page.tsx" "$ROOT/app/(main)/help/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/inbox/page.tsx" "$ROOT/app/(main)/inbox/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/students/page.tsx" "$ROOT/app/(main)/students/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/analysis/page.tsx" "$ROOT/app/(main)/analysis/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/analysis/new/page.tsx" "$ROOT/app/(main)/analysis/new/"
cp -a "$PATCH_DIR/opt-patch/app/(main)/report/[id]/page.tsx" "$ROOT/app/(main)/report/[id]/"
cp -a "$PATCH_DIR/opt-patch/public/zq-friends-score-inject.js" "$ROOT/public/"
cp -a "$PATCH_DIR/opt-patch/public/zq-friends-city-inject.js" "$ROOT/public/"
cp -a "$PATCH_DIR/opt-patch/public/zq-friends-matchmaking-inject.js" "$ROOT/public/"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/journey-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/data.ts" "$ROOT/lib/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/zh-locale-no-english.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/zh-locale-no-english.html 2>/dev/null || true
fi
if [[ -f "$PATCH_DIR/mp-patch/ZH-LOCALE-NO-ENGLISH-NOTE.txt" ]]; then
  cp -a "$PATCH_DIR/mp-patch/ZH-LOCALE-NO-ENGLISH-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'zh-locale-no-english.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "zh-locale-no-english.html" in text:
    raise SystemExit(0)
for marker in (
    "location = /coach-dialog-video-tabs.html",
    "location = /coach-pick-then-chinese.html",
    "location = /friends-city-dual-tabs.html",
):
    idx = text.find(marker)
    if idx >= 0:
        break
else:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /zh-locale-no-english.html {
        alias /var/www/apk/zh-locale-no-english.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted zh-locale-no-english.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next app"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/lib/i18n/messages.ts" \
    "$ROOT/lib/i18n/page-meta.ts" \
    "$ROOT/app/layout.tsx" \
    "$ROOT/app/login/page.tsx" \
    "$ROOT/app/(main)/page.tsx" \
    "$ROOT/app/(main)/friends/page.tsx" \
    "$ROOT/app/(main)/coach/page.tsx" \
    "$ROOT/app/(main)/notices/page.tsx" \
    "$ROOT/app/(main)/notifications/page.tsx" \
    "$ROOT/app/(main)/journey/page.tsx" \
    "$ROOT/app/(main)/help/page.tsx" \
    "$ROOT/app/(main)/inbox/page.tsx" \
    "$ROOT/app/(main)/students/page.tsx" \
    "$ROOT/app/(main)/analysis/page.tsx" \
    "$ROOT/app/(main)/analysis/new/page.tsx" \
    "$ROOT/app/(main)/report/[id]/page.tsx" \
    "$ROOT/public/zq-friends-score-inject.js" \
    "$ROOT/public/zq-friends-city-inject.js" \
    "$ROOT/public/zq-friends-matchmaking-inject.js" \
    "$ROOT/components/profile-view.tsx" \
    "$ROOT/components/journey-view.tsx" \
    "$ROOT/components/friends-view.tsx" \
    "$ROOT/lib/data.ts" 2>/dev/null || true
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
echo "DONE zh-locale-no-english apply on $ROOT"
echo "Live: https://yqchen.blog/tennis (set tennis-locale=zh)"
echo "Preview: https://yqchen.blog/zh-locale-no-english.html"
echo "Backup: $BACKUP"
