#!/usr/bin/env bash
# Apply: match WeChat intro + cancel/rematch/search-challenge
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.match-wechat-intro-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" "$BACKUP/app/api/friends/ladder" "$BACKUP/app/api/friends/intros" "$BACKUP/public/assets"

for f in local-ladder.ts matchmaking.ts match-intros.ts; do
  cp -a "$ROOT/lib/$f" "$BACKUP/lib/" 2>/dev/null || true
done
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/ladder/route.ts" "$BACKUP/app/api/friends/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/api/friends/intros/route.ts" "$BACKUP/app/api/friends/intros/" 2>/dev/null || true

echo "==> Install opt-patch"
cp -a "$PATCH_DIR/opt-patch/lib/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/opt-patch/lib/matchmaking.ts" "$ROOT/lib/matchmaking.ts"
cp -a "$PATCH_DIR/opt-patch/lib/match-intros.ts" "$ROOT/lib/match-intros.ts"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"
cp -a "$PATCH_DIR/opt-patch/components/friends-view.tsx" "$ROOT/components/friends-view.tsx"
mkdir -p "$ROOT/app/api/friends/ladder" "$ROOT/app/api/friends/intros"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/intros/route.ts" "$ROOT/app/api/friends/intros/route.ts"

echo "==> Preview + uniapp injects"
mkdir -p "$ROOT/public" "$ROOT/public/assets"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/match-wechat-intro.html" 2>/dev/null || true
for f in zq-friends-city-inject.js zq-friends-matchmaking-inject.js; do
  if [[ -f "$PATCH_DIR/uniapp-www/$f" ]]; then
    cp -a "$PATCH_DIR/uniapp-www/$f" "$ROOT/public/assets/$f"
    cp -a "$PATCH_DIR/uniapp-www/$f" "$ROOT/public/$f"
  fi
done

python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
injects = ["zq-friends-city-inject.js", "zq-friends-matchmaking-inject.js"]
for html in list(root.glob("**/www/index.html")) + list(root.glob("public/**/index.html")):
    try:
        t = html.read_text()
    except Exception:
        continue
    changed = False
    assets = html.parent / "assets"
    assets.mkdir(exist_ok=True)
    for name in injects:
        src = root / "public" / "assets" / name
        if src.exists():
            (assets / name).write_text(src.read_text())
        script = f'<script src="./assets/{name}"></script>'
        if name in t:
            continue
        if "</body>" in t:
            t = t.replace("</body>", f"  {script}\n</body>")
            changed = True
    if changed:
        html.write_text(t)
        print("wired", html)
PY

echo "==> Build Next app"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || npm run build
  else
    npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true
curl -sf http://127.0.0.1:3000/tennis >/dev/null 2>&1 || curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1 || true
echo "DONE apply match-wechat-intro"
