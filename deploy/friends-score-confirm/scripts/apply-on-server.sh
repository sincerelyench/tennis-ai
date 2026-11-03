#!/usr/bin/env bash
# Apply friends score confirm: pending until opponent confirms → ranking/UTR.
# Includes real-login-names empty=0 directory/ladder base (coord with bc-d575d106).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.friends-score-confirm-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components" \
  "$BACKUP/app/api/auth/session" "$BACKUP/app/api/auth/profile" \
  "$BACKUP/app/api/friends/directory" "$BACKUP/app/api/friends/ladder" \
  "$BACKUP/app/api/friends/scores" "$BACKUP/app/api/friends/scores/action" \
  "$BACKUP/app/api/coaches" "$BACKUP/public/assets" "$BACKUP/lib/i18n"

for f in auth-store.ts session-role.ts local-ladder.ts matchmaking.ts match-demo.ts match-store.ts data.ts match-scores.ts; do
  cp -a "$ROOT/lib/$f" "$BACKUP/lib/" 2>/dev/null || true
done
for f in friends-view.tsx profile-view.tsx coach-chat-personas.tsx coach-view.tsx match-record-view.tsx; do
  cp -a "$ROOT/components/$f" "$BACKUP/components/" 2>/dev/null || true
done
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth/session/route.ts" "$BACKUP/app/api/auth/session/" 2>/dev/null || true
cp -a "$ROOT/app/api/coaches/route.ts" "$BACKUP/app/api/coaches/" 2>/dev/null || true

echo "==> Install opt-patch libs/components/APIs"
cp -a "$PATCH_DIR/opt-patch/lib/." "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/components/." "$ROOT/components/"
mkdir -p "$ROOT/app/api/auth/session" "$ROOT/app/api/auth/profile" \
  "$ROOT/app/api/friends/directory" "$ROOT/app/api/friends/ladder" \
  "$ROOT/app/api/friends/scores" "$ROOT/app/api/friends/scores/action" \
  "$ROOT/app/api/coaches"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/session/route.ts" "$ROOT/app/api/auth/session/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/profile/route.ts" "$ROOT/app/api/auth/profile/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/directory/route.ts" "$ROOT/app/api/friends/directory/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/ladder/route.ts" "$ROOT/app/api/friends/ladder/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/route.ts" "$ROOT/app/api/friends/scores/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/friends/scores/action/route.ts" "$ROOT/app/api/friends/scores/action/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/coaches/route.ts" "$ROOT/app/api/coaches/route.ts"

if [[ -f "$PATCH_DIR/scripts/cleanup-fake-names.py" ]]; then
  echo "==> Cleanup fake seeded names"
  python3 "$PATCH_DIR/scripts/cleanup-fake-names.py" "$ROOT" || true
fi

echo "==> Preview + uniapp injects"
mkdir -p "$ROOT/public" "$ROOT/public/assets"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/friends-score-confirm.html" 2>/dev/null || true
for f in zq-friends-city-inject.js zq-friends-matchmaking-inject.js zq-friends-score-inject.js zq-network-coach-inject.js; do
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

echo "==> Patch i18n score-confirm keys"
ROOT="$ROOT" python3 - <<'PY'
from pathlib import Path
import os
root = Path(os.environ["ROOT"])
for rel in ["lib/i18n/messages.ts", "lib/messages.ts"]:
    p = root / rel
    if not p.exists():
        continue
    text = p.read_text()
    for old, new in [
        ('scoreLead: "Player names and set scores. Saved on this device.",',
         'scoreLead: "Player names and set scores. Saved on this device.",\n'
         '      scoreLeadConfirm: "Submit a score; the opponent must confirm before it updates ranking/UTR.",\n'
         '      scorePendingInbox: "Awaiting my confirmation",\n'
         '      scoreConfirm: "Confirm",\n'
         '      scoreReject: "Reject",\n'
         '      scoreStatusPending: "Pending",\n'
         '      scoreStatusConfirmed: "Confirmed",\n'
         '      scoreStatusRejected: "Rejected",\n'
         '      scorePendingHint: "Submitted — waiting for opponent confirmation.",\n'
         '      scoreConfirmedHint: "Confirmed. Ranking and UTR updated.",\n'
         '      scoreRejectedHint: "Rejected. Not added to ranking.",\n'
         '      scoreOfflinePending: "Offline — saved locally as pending (not ranked).",'),
        ('scoreLead: "填写球员名和盘分，保存在本机历史。",',
         'scoreLead: "填写球员名和盘分，保存在本机历史。",\n'
         '      scoreLeadConfirm: "提交比分后需对方确认，确认后才计入排行与 UTR。",\n'
         '      scorePendingInbox: "待我确认",\n'
         '      scoreConfirm: "确认",\n'
         '      scoreReject: "拒绝",\n'
         '      scoreStatusPending: "待确认",\n'
         '      scoreStatusConfirmed: "已确认",\n'
         '      scoreStatusRejected: "已拒绝",\n'
         '      scorePendingHint: "已提交，等待对方确认。",\n'
         '      scoreConfirmedHint: "已确认，排行与 UTR 已更新。",\n'
         '      scoreRejectedHint: "已拒绝，未计入排行。",\n'
         '      scoreOfflinePending: "离线：已在本机记为待确认（未进排行）。",'),
        ('saveScore: "Save score",', 'saveScore: "Submit score",'),
        ('saveScore: "保存比分",', 'saveScore: "提交比分",'),
        ('scoreHistory: "Saved scores",', 'scoreHistory: "Scores",'),
        ('scoreHistory: "本机比分",', 'scoreHistory: "比分记录",'),
        ('scoreEmptyDesc: "Enter a match above to keep a local history.",',
         'scoreEmptyDesc: "Submit a match above. It stays pending until the opponent confirms.",'),
        ('scoreEmptyDesc: "在上方录入一场比赛后会显示在这里。",',
         'scoreEmptyDesc: "在上方提交比赛后会显示；对方确认前为待确认。",'),
        ('scoreEmpty: "No saved scores yet",', 'scoreEmpty: "No scores yet (0)",'),
        ('scoreEmpty: "还没有保存的比分",', 'scoreEmpty: "还没有比分（0）",'),
        ('matchEmpty: "No matchable buddies near {city}.",',
         'matchEmpty: "No matchable buddies near {city} (0).",'),
        ('matchEmpty: "{city} 附近暂时没有可匹配球友。",',
         'matchEmpty: "{city} 附近暂时没有可匹配球友（0）。",'),
        ('emptyRankCity: "No players in {city} yet. Enter a score above or pick another city.",',
         'emptyRankCity: "No logged-in players with a display name in {city} (0).",'),
        ('emptyRankCity: "{city} 暂无球员。可在上方录入比分，或换一座城市。",',
         'emptyRankCity: "{city} 暂无已登录且设置显示名的球员（0）。",'),
    ]:
        if old not in text:
            continue
        if "scoreLeadConfirm" in new and "scoreLeadConfirm" in text:
            continue
        text = text.replace(old, new, 1)
    p.write_text(text)
    print("i18n patched", p)
PY

echo "==> Build Next + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  systemctl is-active tennis-ai
fi

echo "==> Done friends-score-confirm @ $STAMP"
