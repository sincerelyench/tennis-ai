#!/usr/bin/env bash
# Apply tabs-swap-yueqiu: 球友→约球 / Friends→Play；约球与教练换位。
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.tabs-swap-yueqiu-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib/i18n" "$BACKUP/components" "$BACKUP/public/assets"

cp -a "$ROOT/components/app-shell.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib/i18n" "$ROOT/components" "$ROOT/public/assets" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/components/app-shell.tsx" "$ROOT/components/app-shell.tsx"
cp -a "$PATCH_DIR/opt-patch/lib/i18n/messages.ts" "$ROOT/lib/i18n/messages.ts"

echo "==> Preview + uniapp inject"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/tabs-swap-yueqiu.html" 2>/dev/null || true
for f in zq-tabs-swap-yueqiu-inject.js \
  zq-remove-profile-training-inject.js zq-remove-devices-inject.js \
  zq-profile-city-inject.js zq-friends-city-inject.js \
  zq-friends-score-inject.js zq-friends-matchmaking-inject.js \
  zq-network-coach-inject.js; do
  if [[ -f "$PATCH_DIR/uniapp-www/$f" ]]; then
    cp -a "$PATCH_DIR/uniapp-www/$f" "$ROOT/public/assets/$f"
    cp -a "$PATCH_DIR/uniapp-www/$f" "$ROOT/public/$f"
  fi
done

python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
injects = [
    "zq-friends-city-inject.js",
    "zq-friends-matchmaking-inject.js",
    "zq-friends-score-inject.js",
    "zq-profile-city-inject.js",
    "zq-remove-devices-inject.js",
    "zq-remove-profile-training-inject.js",
    "zq-network-coach-inject.js",
    "zq-tabs-swap-yueqiu-inject.js",
]
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
        if name in t:
            continue
        if "</body>" in t:
            t = t.replace("</body>", f'  <script src="./assets/{name}"></script>\n</body>')
            changed = True
    if changed:
        html.write_text(t)
        print("wired", html)
PY

echo "==> Build Next + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  systemctl is-active tennis-ai
fi

echo "==> Done tabs-swap-yueqiu @ $STAMP"
