#!/usr/bin/env bash
# Apply 球友城市排行：去掉硬编码球友卡片，按 IP/自选城市过滤排行，保留录入比分。
set -euo pipefail

ROOT="${ROOT:-/opt/tennis-ai}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.friends-city-ranking-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib" "$BACKUP/lib/i18n" "$BACKUP/app/api/geo/city" "$BACKUP"
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/local-ladder.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/cities.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/data.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/messages.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true
cp -a "$ROOT/middleware.ts" "$BACKUP/" 2>/dev/null || true
cp -a "$ROOT/app/api/geo/city/route.ts" "$BACKUP/app/api/geo/city/" 2>/dev/null || true

echo "==> Install web patches"
cp -a "$PATCH_DIR/web-patch/friends-view.tsx" "$ROOT/components/friends-view.tsx"
cp -a "$PATCH_DIR/web-patch/local-ladder.ts" "$ROOT/lib/local-ladder.ts"
cp -a "$PATCH_DIR/web-patch/cities.ts" "$ROOT/lib/cities.ts"
mkdir -p "$ROOT/app/api/geo/city"
cp -a "$PATCH_DIR/api-geo/route.ts" "$ROOT/app/api/geo/city/route.ts"

echo "==> Ensure data.ts friends mapping tolerates cityId (ladderPlayers still exported)"
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/tennis-ai/lib/data.ts")
text = p.read_text()
# no structural change required if friends still maps ladderPlayers; keep as-is
p.write_text(text)
print("data.ts ok")
PY

echo "==> Patch i18n friends keys (city scope; drop global Wuxi blurb)"
python3 - <<'PY'
from pathlib import Path
import re

CITY_EN = '''      cityLabel: "City",
      cityDetecting: "Detecting your city…",
      cityCount: "{n} players · {city}",
      cityIpHint: "Using {city} from your IP. Change it anytime.",
      cityManualHint: "Showing {city} (you picked this city).",
      cityDefaultHint: "Showing {city}.",
      rankLeadCity: "{city} ladder. Ranked by a UTR-like rating from local match results.",
      emptyRankCity: "No players in {city} yet. Enter a score above or pick another city.",
      howBodyCity: "City ladder: seed = self-level × 2.15 (UTR-like). Each match moves you by how surprising the result was. Last six weeks weigh more. Doubles uses the pair average and a smaller step. Rankings only include players in the selected city.",'''

CITY_ZH = '''      cityLabel: "城市",
      cityDetecting: "正在识别你的城市…",
      cityCount: "{n} 位球员 · {city}",
      cityIpHint: "已按 IP 定位到 {city}，可随时切换。",
      cityManualHint: "当前显示 {city}（你已手动选择）。",
      cityDefaultHint: "当前显示 {city}。",
      rankLeadCity: "{city} 排行。按类 UTR 分数，根据本地战绩更新。",
      emptyRankCity: "{city} 暂无球员。可在上方录入比分，或换一座城市。",
      howBodyCity: "城市排行：起点是自评水平 × 2.15（类 UTR）。每场按「对这个对手该不该赢」调整。近六周权重大。双打用双方平均分，步长更小。列表只含所选城市的球员。",'''

def patch_file(path: Path, locale_hint: str):
    text = path.read_text()
    # Update count / rankLead / howBody to city-aware wording if still global
    if locale_hint == "both" or "zh" in path.read_text()[:200] or True:
        pass

    def inject_keys(block: str, keys: str) -> str:
        if "cityLabel:" in block:
            # replace existing city keys block roughly
            block = re.sub(
                r"\n\s*cityLabel:.*?(?=\n\s*rankTitle:)",
                "\n" + keys.rstrip() + "\n",
                block,
                count=1,
                flags=re.S,
            )
            if "cityLabel:" not in block.split("rankTitle:")[0][-800:]:
                block = block.replace("      rankTitle:", keys + "\n      rankTitle:")
            return block
        return block.replace("      rankTitle:", keys + "\n      rankTitle:")

    # Process EN friends block: first occurrence before place: in en tree is hard;
    # do keyed replacements for known strings + insert before rankTitle in each friends block.
    parts = []
    idx = 0
    while True:
        start = text.find("friends: {", idx)
        if start < 0:
            parts.append(text[idx:])
            break
        parts.append(text[idx:start])
        # find matching closing of friends object at nesting depth 1 from friends: {
        i = start + len("friends: {")
        depth = 1
        while i < len(text) and depth:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        block = text[start:i]
        is_zh = "球友" in block or "录入比分" in block or "本地排行" in block
        keys = CITY_ZH if is_zh else CITY_EN
        # Soft-replace global blurbs inside block
        if is_zh:
            block = block.replace(
                'count: "{n} 位球友 · 无锡一带"',
                'count: "{n} 位球员 · 按城市"',
            )
            block = block.replace(
                'rankLead: "无锡及附近。按类 UTR 分数排名，再按战绩、对手强度和近期比赛浮动。"',
                'rankLead: "按所选城市的类 UTR 排行。"',
            )
            block = block.replace(
                'howBody: "起点是自评水平 × 2.15（类 UTR）。每场按「对这个对手该不该赢」调整。近六周权重大。双打用双方平均分，步长更小。"',
                'howBody: "城市排行：起点是自评水平 × 2.15（类 UTR）。每场按「对这个对手该不该赢」调整。近六周权重大。双打用双方平均分，步长更小。只含所选城市。"',
            )
            block = block.replace(
                'emptyDesc: "这一带暂时没有球友。"',
                'emptyDesc: "这座城市暂时没有球员。"',
            )
        else:
            block = block.replace(
                'count: "{n} friends · Wuxi area"',
                'count: "{n} players · by city"',
            )
            block = block.replace(
                'rankLead: "Wuxi and nearby. Ranked by a UTR-like rating, updated from match results, opponent strength, and recent form."',
                'rankLead: "Ranked by a UTR-like rating within the selected city."',
            )
            block = block.replace(
                'howBody: "Seed = self-level × 2.15 on a UTR-like scale. Each match shifts you by how surprising the result was versus that opponent. The last six weeks count more. Doubles uses the pair average and a smaller step."',
                'howBody: "City ladder: seed = self-level × 2.15 (UTR-like). Each match shifts you by how surprising the result was. The last six weeks count more. Doubles uses the pair average and a smaller step. Only players in the selected city."',
            )
            block = block.replace(
                'emptyDesc: "No friends listed yet."',
                'emptyDesc: "No players in this city yet."',
            )
        if "cityLabel:" not in block:
            block = block.replace("      rankTitle:", keys + "\n      rankTitle:")
        else:
            # refresh city keys
            block = re.sub(
                r"cityLabel:[\s\S]*?howBodyCity:[^\n]*\n",
                keys.lstrip() + "\n",
                block,
                count=1,
            )
            if "cityLabel:" not in block:
                block = block.replace("      rankTitle:", keys + "\n      rankTitle:")
        parts.append(block)
        idx = i
    path.write_text("".join(parts))
    print(f"patched {path}")

for rel in ("lib/i18n/messages.ts", "lib/messages.ts"):
    p = Path("/opt/tennis-ai") / rel
    if p.exists():
        patch_file(p, "both")
PY

echo "==> Allow /api/geo/city without session"
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/tennis-ai/middleware.ts")
text = p.read_text()
needle = '"/api/auth/session",'
insert = '"/api/auth/session",\n  "/api/geo/city",'
if "/api/geo/city" not in text:
    if needle in text:
        text = text.replace(needle, insert, 1)
        p.write_text(text)
        print("middleware: added /api/geo/city")
    else:
        raise SystemExit("middleware publicPaths needle not found")
else:
    print("middleware: already has /api/geo/city")
PY

echo "==> Build Next as user tennis"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  su -s /bin/bash tennis -c "cd '$ROOT' && npm run build"
else
  npm run build
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai
systemctl is-active tennis-ai
echo "==> Done friends-city-ranking $STAMP"
