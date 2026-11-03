#!/usr/bin/env bash
# Apply remove-settings-devices: drop Devices from 我的/settings; /devices → 我的.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.remove-settings-devices-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/app/(main)/devices" "$BACKUP/public/assets"

cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/app-shell.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/(main)/devices/page.tsx" "$BACKUP/app/(main)/devices/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/components" "$ROOT/app/(main)/devices" "$ROOT/public/assets" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/profile-view.tsx"
cp -a "$PATCH_DIR/opt-patch/components/app-shell.tsx" "$ROOT/components/app-shell.tsx"
cp -a "$PATCH_DIR/opt-patch/app/(main)/devices/page.tsx" "$ROOT/app/(main)/devices/page.tsx"

echo "==> Preview + inject"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/remove-settings-devices.html" 2>/dev/null || true
for f in zq-remove-devices-inject.js zq-profile-city-inject.js zq-friends-city-inject.js zq-friends-score-inject.js zq-friends-matchmaking-inject.js; do
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

echo "==> Build Next + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  chown -R tennis:tennis "$ROOT/.next" "$ROOT/components" "$ROOT/app" "$ROOT/public" 2>/dev/null || true
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  systemctl is-active tennis-ai
fi

echo "==> Done remove-settings-devices @ $STAMP"
