#!/usr/bin/env bash
# Apply 涨球教练 + 网络教练问答 onto /opt/tennis-ai
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.network-coach-chat-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib" "$BACKUP/app/api/coach/chat" "$BACKUP/public"
cp -a "$ROOT/components/coach-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/app/api/coach/chat/route.ts" "$BACKUP/app/api/coach/chat/" 2>/dev/null || true
cp -a "$ROOT/lib/network-coach-persona.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/coach-chat-personas.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Install opt-patch"
cp -a "$PATCH_DIR/opt-patch/lib/network-coach-persona.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/components/coach-chat-personas.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
mkdir -p "$ROOT/app/api/coach/chat"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/chat/route.ts" "$ROOT/app/api/coach/chat/route.ts"

echo "==> Ensure coach-publish exports used by personas (PLAYER_SELECTED_COACH_KEY etc.)"
python3 - <<PY
from pathlib import Path
p = Path("$ROOT/lib/coach-publish.ts")
text = p.read_text()
changed = False
# Force display names away from 掌球 / Poppy
if 'DEFAULT_COACH_NAME_ZH = "掌球教练"' in text:
    text = text.replace('DEFAULT_COACH_NAME_ZH = "掌球教练"', 'DEFAULT_COACH_NAME_ZH = "涨球教练"')
    changed = True
if "掌球教练" in text:
    text = text.replace("掌球教练", "涨球教练")
    changed = True
if "Palm Ball" in text:
    text = text.replace("Palm Ball Coach", "Zhangqiu Coach")
    changed = True
if "PLAYER_SELECTED_COACH_KEY" not in text:
    text = text.replace(
        'export const DEFAULT_COACH_ID = "poppy";',
        'export const DEFAULT_COACH_ID = "poppy";\nexport const PLAYER_SELECTED_COACH_KEY = "tennis-player-selected-coach-v1";',
    )
    changed = True
# banned list already includes poppy
if changed:
    p.write_text(text)
    print("coach-publish.ts updated")
else:
    print("coach-publish.ts ok")
PY

echo "==> Seed network coach (林凯教练) distinct from 涨球教练"
python3 "$PATCH_DIR/scripts/seed-network-coach.py" "$ROOT"

echo "==> Preview + uniapp inject for static public"
mkdir -p "$ROOT/public" "$ROOT/public/assets"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/network-coach-chat.html"
cp -a "$PATCH_DIR/uniapp-www/zq-network-coach-inject.js" "$ROOT/public/assets/zq-network-coach-inject.js"
cp -a "$PATCH_DIR/uniapp-www/zq-network-coach-inject.js" "$ROOT/public/zq-network-coach-inject.js"

# If a packaged uni-app www exists under public or apps, wire script tag
python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
needle = "zq-network-coach-inject.js"
script = '<script src="./assets/zq-network-coach-inject.js"></script>'
for html in list(root.glob("**/www/index.html")) + list(root.glob("public/**/index.html")):
    try:
        t = html.read_text()
    except Exception:
        continue
    if needle in t:
        print("already wired", html)
        continue
    if "zq-match-record-inject.js" in t:
        t = t.replace(
            '<script src="./assets/zq-match-record-inject.js"></script>',
            '<script src="./assets/zq-match-record-inject.js"></script>\n  ' + script,
        )
    elif "</body>" in t:
        t = t.replace("</body>", "  " + script + "\n</body>")
    else:
        continue
    assets = html.parent / "assets"
    assets.mkdir(exist_ok=True)
    src = root / "public" / "assets" / "zq-network-coach-inject.js"
    if src.exists():
        (assets / "zq-network-coach-inject.js").write_text(src.read_text())
    html.write_text(t)
    print("wired", html)
PY

echo "==> Build + restart"
cd "$ROOT"
if command -v npm >/dev/null; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai || true
fi

echo "DONE network-coach-chat apply on $ROOT"
echo "Preview: https://yqchen.blog/tennis/network-coach-chat.html"
