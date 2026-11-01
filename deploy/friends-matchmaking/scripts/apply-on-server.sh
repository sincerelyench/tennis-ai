#!/usr/bin/env bash
# Apply 球友王者式匹配：按水平/城市/UTR 匹配附近球友；保留城市排行 + 录入比分；无搜索球友/球场。
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.friends-matchmaking-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib" "$BACKUP/lib/i18n" "$BACKUP/app/api/geo/city" "$BACKUP/public/assets" "$BACKUP"
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/cities.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/matchmaking.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/messages.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/middleware.ts" "$BACKUP/" 2>/dev/null || true
cp -a "$ROOT/app/api/geo/city/route.ts" "$BACKUP/app/api/geo/city/" 2>/dev/null || true

echo "==> Install web patches"
cp -a "$PATCH_DIR/web-patch/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/web-patch/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/web-patch/cities.ts" "$ROOT/lib/cities.ts"
cp -a "$PATCH_DIR/web-patch/matchmaking.ts" "$ROOT/lib/matchmaking.ts"
if [[ -f "$PATCH_DIR/api-geo/route.ts" ]]; then
  mkdir -p "$ROOT/app/api/geo/city"
  cp -a "$PATCH_DIR/api-geo/route.ts" "$ROOT/app/api/geo/city/route.ts"
fi

echo "==> Preview + uniapp inject for static public"
mkdir -p "$ROOT/public" "$ROOT/public/assets"
cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/friends-matchmaking.html"
cp -a "$PATCH_DIR/uniapp-www/zq-friends-matchmaking-inject.js" "$ROOT/public/assets/zq-friends-matchmaking-inject.js"
cp -a "$PATCH_DIR/uniapp-www/zq-friends-city-inject.js" "$ROOT/public/assets/zq-friends-city-inject.js" 2>/dev/null || true

python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
needle = "zq-friends-matchmaking-inject.js"
script = '<script src="./assets/zq-friends-matchmaking-inject.js"></script>'
for html in list(root.glob("**/www/index.html")) + list(root.glob("public/**/index.html")):
    try:
        t = html.read_text()
    except Exception:
        continue
    if needle in t:
        print("already wired", html)
        continue
    if "zq-friends-city-inject.js" in t:
        t = t.replace(
            '<script src="./assets/zq-friends-city-inject.js"></script>',
            '<script src="./assets/zq-friends-city-inject.js"></script>\n  ' + script,
        )
    elif "</body>" in t:
        t = t.replace("</body>", "  " + script + "\n</body>")
    else:
        continue
    assets = html.parent / "assets"
    assets.mkdir(exist_ok=True)
    src = root / "public" / "assets" / "zq-friends-matchmaking-inject.js"
    if src.exists():
        (assets / "zq-friends-matchmaking-inject.js").write_text(src.read_text())
    html.write_text(t)
    print("wired", html)
PY

echo "==> Patch i18n friends matchmaking keys"
python3 - <<PY
from pathlib import Path
import re
ROOT = Path("$ROOT")

MATCH_EN = '''      matchTitle: "Find a match",
      matchLead: "Match a nearby buddy by level, city, and UTR-like rating — like queueing a ranked game.",
      matchSelfName: "Your name",
      matchSelfNamePh: "Optional",
      matchSelfLevel: "Your level",
      matchYou: "You",
      matchSelfMeta: "{city} · level {level} · UTR {utr}",
      matchStart: "Start matching",
      matchIdleHint: "Prefers same city and close UTR; widens to nearby cities if needed.",
      matchSearching: "Matching a nearby buddy…",
      matchHint1: "Scanning same-city players…",
      matchHint2: "Comparing UTR proximity…",
      matchHint3: "Checking self-level…",
      matchHint4: "Locking a fair match…",
      matchCancel: "Cancel",
      matchFound: "Match found",
      matchBuddyMeta: "{city} · level {level} · local #{rank}",
      matchReason: {
        sameCityClose: "Same city, UTR Δ {utrDelta} — evenly matched",
        sameCityOk: "Same-city buddy, UTR Δ {utrDelta}",
        nearbyClose: "Nearby {city}, very close UTR (Δ {utrDelta})",
        nearbyOk: "Nearby {city}, best overall fit (UTR Δ {utrDelta})",
      },
      matchAgain: "Match again",
      matchInvite: "Enter score",
      matchEmpty: "No matchable buddies near {city}.",
      cityLabel: "City",
      cityDetecting: "Detecting your city…",
      cityCount: "{n} players · {city}",
      cityIpHint: "Using {city} from your IP. Change it anytime.",
      cityManualHint: "Showing {city} (you picked this city).",
      cityDefaultHint: "Showing {city}.",
      rankLeadCity: "{city} ladder. Ranked by a UTR-like rating from local match results.",
      emptyRankCity: "No players in {city} yet. Enter a score above or pick another city.",
      howBodyCity: "City ladder: seed = self-level × 2.15 (UTR-like). Each match moves you by how surprising the result was. Last six weeks weigh more. Doubles uses the pair average and a smaller step. Rankings only include players in the selected city.",'''

MATCH_ZH = '''      matchTitle: "匹配约球",
      matchLead: "按你的水平、城市和类 UTR，匹配一位合适的附近球友。像开一把排位。",
      matchSelfName: "怎么称呼你",
      matchSelfNamePh: "可选",
      matchSelfLevel: "自评水平",
      matchYou: "我",
      matchSelfMeta: "{city} · 水平 {level} · UTR {utr}",
      matchStart: "开始匹配",
      matchIdleHint: "优先同城、UTR 接近的球友；找不到再放宽到邻近城市。",
      matchSearching: "正在匹配附近球友…",
      matchHint1: "扫描同城球友…",
      matchHint2: "比对 UTR 接近度…",
      matchHint3: "核对自评水平…",
      matchHint4: "锁定合适对手…",
      matchCancel: "取消",
      matchFound: "匹配成功",
      matchBuddyMeta: "{city} · 水平 {level} · 本地第 {rank}",
      matchReason: {
        sameCityClose: "同城，UTR 相差 {utrDelta}，势均力敌",
        sameCityOk: "同城球友，UTR 相差 {utrDelta}",
        nearbyClose: "邻近城市 {city}，UTR 很接近（Δ {utrDelta}）",
        nearbyOk: "邻近 {city}，综合最合适（UTR Δ {utrDelta}）",
      },
      matchAgain: "再匹配一次",
      matchInvite: "录入对阵",
      matchEmpty: "{city} 附近暂时没有可匹配球友。",
      cityLabel: "城市",
      cityDetecting: "正在识别你的城市…",
      cityCount: "{n} 位球员 · {city}",
      cityIpHint: "已按 IP 定位到 {city}，可随时切换。",
      cityManualHint: "当前显示 {city}（你已手动选择）。",
      cityDefaultHint: "当前显示 {city}。",
      rankLeadCity: "{city} 排行。按类 UTR 分数，根据本地战绩更新。",
      emptyRankCity: "{city} 暂无球员。可在上方录入比分，或换一座城市。",
      howBodyCity: "城市排行：起点是自评水平 × 2.15（类 UTR）。每场按「对这个对手该不该赢」调整。近六周权重大。双打用双方平均分，步长更小。列表只含所选城市的球员。",'''

def patch_file(path: Path):
    text = path.read_text()
    parts = []
    idx = 0
    while True:
        start = text.find("friends: {", idx)
        if start < 0:
            parts.append(text[idx:])
            break
        parts.append(text[idx:start])
        i = start + len("friends: {")
        depth = 1
        while i < len(text) and depth:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        block = text[start:i]
        is_zh = "球友" in block or "录入比分" in block or "本地排行" in block or "匹配约球" in block
        keys = MATCH_ZH if is_zh else MATCH_EN
        if "matchTitle:" in block:
            block2 = re.sub(r"matchTitle:[\s\S]*?howBodyCity:[^\n]*\n", keys.lstrip() + "\n", block, count=1)
            block = block2 if "matchTitle:" in block2 else block.replace("      rankTitle:", keys + "\n      rankTitle:")
        elif "cityLabel:" in block and "matchTitle:" not in block:
            block = block.replace("      cityLabel:", keys.split("cityLabel:")[0] + "      cityLabel:", 1)
        if "matchTitle:" not in block:
            block = block.replace("      rankTitle:", keys + "\n      rankTitle:")
        parts.append(block)
        idx = i
    path.write_text("".join(parts))
    print(f"patched {path}")

for rel in ("lib/i18n/messages.ts", "lib/messages.ts"):
    p = ROOT / rel
    if p.exists():
        patch_file(p)
PY

echo "==> Allow friends-matchmaking preview + /api/geo/city in middleware"
python3 - <<PY
from pathlib import Path
p = Path("$ROOT/middleware.ts")
if not p.exists():
    print("no middleware")
else:
    text = p.read_text()
    if "friends-matchmaking" not in text:
        needle_nc = 'if (p.includes("network-coach-chat")) return NextResponse.next();'
        if needle_nc in text:
            text = text.replace(
                needle_nc,
                needle_nc
                + '\n  if (p.includes("friends-matchmaking")) return NextResponse.next();'
                + '\n  if (p.includes("zq-friends-matchmaking-inject")) return NextResponse.next();',
            )
            print("middleware: friends-matchmaking allow")
        else:
            print("middleware: network-coach needle missing")
    else:
        print("middleware: friends-matchmaking already")
    needle = '"/api/auth/session",'
    insert = '"/api/auth/session",\n  "/api/geo/city",'
    if "/api/geo/city" not in text:
        if needle in text:
            text = text.replace(needle, insert, 1)
            print("middleware: added /api/geo/city")
        else:
            print("middleware: geo needle missing; skip")
    else:
        print("middleware: already has /api/geo/city")
    p.write_text(text)
PY

echo "==> Build Next"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  su -s /bin/bash tennis -c "cd '$ROOT' && npm run build" || sudo -u tennis npm run build
else
  npm run build
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai || true
systemctl is-active tennis-ai || true
echo "==> Done friends-matchmaking $STAMP"
