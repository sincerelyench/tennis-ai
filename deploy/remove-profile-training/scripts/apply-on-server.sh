#!/usr/bin/env bash
# Apply remove-profile-training: drop plan menu + weekly training from Profile.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.remove-profile-training-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" "$BACKUP/app/api/auth/profile" "$BACKUP/public/assets"

for f in cities.ts session-role.ts; do
  cp -a "$ROOT/lib/$f" "$BACKUP/lib/" 2>/dev/null || true
done
cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/app-shell.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/components/notices-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/profile/route.ts" "$BACKUP/app/api/auth/profile/" 2>/dev/null || true
mkdir -p "$BACKUP/app/(main)/plan"
cp -a "$ROOT/app/(main)/plan/page.tsx" "$BACKUP/app/(main)/plan/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/components" "$ROOT/app/api/auth/profile" "$ROOT/app/(main)/plan" "$ROOT/public/assets" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/lib/." "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/components/." "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/profile/route.ts" "$ROOT/app/api/auth/profile/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/(main)/plan/page.tsx" "$ROOT/app/(main)/plan/page.tsx"
if [[ -f "$PATCH_DIR/opt-patch/app/(main)/devices/page.tsx" ]]; then
  mkdir -p "$ROOT/app/(main)/devices"
  cp -a "$PATCH_DIR/opt-patch/app/(main)/devices/page.tsx" "$ROOT/app/(main)/devices/page.tsx"
fi

echo "==> Preview + uniapp injects"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/remove-profile-training.html" 2>/dev/null || true
for f in zq-remove-profile-training-inject.js zq-remove-devices-inject.js zq-profile-city-inject.js zq-friends-city-inject.js zq-friends-score-inject.js zq-friends-matchmaking-inject.js; do
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
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  systemctl is-active tennis-ai
fi

echo "==> Done remove-profile-training @ $STAMP"
