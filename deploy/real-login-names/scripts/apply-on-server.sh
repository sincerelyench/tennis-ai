#!/usr/bin/env bash
# Apply real logged-in display names (no fake 陈晓 / 林凯教练). Empty lists show 0.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.real-login-names-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" "$BACKUP/app/api/auth/session" \
  "$BACKUP/app/api/auth/profile" "$BACKUP/app/api/friends/directory" \
  "$BACKUP/app/api/friends/ladder" "$BACKUP/app/api/coaches" "$BACKUP/public/assets"

for f in auth-store.ts session-role.ts local-ladder.ts matchmaking.ts match-demo.ts match-store.ts data.ts; do
  cp -a "$ROOT/lib/$f" "$BACKUP/lib/" 2>/dev/null || true
done
for f in friends-view.tsx profile-view.tsx coach-chat-personas.tsx coach-view.tsx match-record-view.tsx; do
  cp -a "$ROOT/components/$f" "$BACKUP/components/" 2>/dev/null || true
done
cp -a "$ROOT/app/api/auth/session/route.ts" "$BACKUP/app/api/auth/session/" 2>/dev/null || true
cp -a "$ROOT/app/api/coaches/route.ts" "$BACKUP/app/api/coaches/" 2>/dev/null || true

echo "==> Install opt-patch libs/components/APIs"
cp -a "$PATCH_DIR/opt-patch/lib/." "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/components/." "$ROOT/components/"
mkdir -p "$ROOT/app/api/auth/session" "$ROOT/app/api/auth/profile" \
  "$ROOT/app/api/friends/directory" "$ROOT/app/api/friends/ladder" "$ROOT/app/api/coaches"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/session/route.ts" "$ROOT/app/api/auth/session/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/profile/route.ts" "$ROOT/app/api/auth/profile/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/directory/route.ts" "$ROOT/app/api/friends/directory/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/coaches/route.ts" "$ROOT/app/api/coaches/route.ts"

echo "==> Cleanup fake seeded names (林凯教练 / demo ladder names)"
python3 "$PATCH_DIR/scripts/cleanup-fake-names.py" "$ROOT"

echo "==> Preview + uniapp injects"
mkdir -p "$ROOT/public" "$ROOT/public/assets"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/real-login-names.html" 2>/dev/null || true
for f in zq-friends-city-inject.js zq-friends-matchmaking-inject.js zq-network-coach-inject.js; do
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
    "zq-network-coach-inject.js",
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

echo "==> Patch i18n empty-rank city key if missing"
python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
for rel in ["lib/i18n/messages.ts", "lib/messages.ts"]:
    p = root / rel
    if not p.exists():
        continue
    text = p.read_text()
    changed = False
    if "emptyRankCity" not in text:
        for a, b in [
            ('emptyRank: "No players in this city yet.",', 'emptyRank: "No players in this city yet.",\n      emptyRankCity: "No logged-in players with a display name in {city} (0).",'),
            ('emptyRank: "该城市暂无球员。",', 'emptyRank: "该城市暂无球员。",\n      emptyRankCity: "{city} 暂无已登录且设置显示名的球员（0）。",'),
            ('emptyRank: "No players yet.",', 'emptyRank: "No players yet.",\n      emptyRankCity: "No logged-in players with a display name in {city} (0).",'),
        ]:
            if a in text and "emptyRankCity" not in text:
                text = text.replace(a, b)
                changed = True
    if changed:
        p.write_text(text)
        print("i18n patched", p)
    else:
        print("i18n ok", p)
PY

echo "==> Build Next + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  systemctl is-active tennis-ai
fi

echo "==> Done real-login-names @ $STAMP"
