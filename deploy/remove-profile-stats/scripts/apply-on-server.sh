#!/usr/bin/env bash
# Apply remove-profile-stats: drop stats strip + most-practiced / recent-trend cards.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.remove-profile-stats-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/public/assets"

cp -a "$ROOT/components/profile-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch (profile-view only — keep peer patches)"
mkdir -p "$ROOT/components" "$ROOT/public/assets" "$ROOT/public"
cp -a "$PATCH_DIR/opt-patch/components/profile-view.tsx" "$ROOT/components/profile-view.tsx"

echo "==> Preview + uniapp injects"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/remove-profile-stats.html" 2>/dev/null || true
cp -a "$PATCH_DIR/preview/mock-profile.html" "$ROOT/public/remove-profile-stats-mock.html" 2>/dev/null || true

INJECTS=(
  zq-remove-profile-stats-inject.js
  zq-remove-profile-training-inject.js
  zq-remove-devices-inject.js
  zq-profile-city-inject.js
  zq-friends-city-inject.js
  zq-friends-score-inject.js
  zq-friends-matchmaking-inject.js
)
for f in "${INJECTS[@]}"; do
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
    "zq-remove-profile-stats-inject.js",
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

echo "==> Done remove-profile-stats @ $STAMP"
