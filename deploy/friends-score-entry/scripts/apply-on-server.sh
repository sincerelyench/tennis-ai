#!/usr/bin/env bash
# Apply 球友比分录入 + purge 搜索球友/球场 leftovers on /opt/tennis-ai, then rebuild Next.
set -euo pipefail

ROOT="${ROOT:-/opt/tennis-ai}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.friends-score-entry-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib" "$BACKUP/lib/i18n"
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/lib/messages.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/lib/i18n/messages.ts" "$BACKUP/lib/i18n/" 2>/dev/null || true

echo "==> Install friends-view.tsx"
cp -a "$PATCH_DIR/web-patch/friends-view.tsx" "$ROOT/components/friends-view.tsx"

echo "==> Patch friends i18n (purge search keys, add score keys, UTR wording in lib/messages.ts)"
python3 - <<'PY'
from pathlib import Path
import re

SCORE_EN = '''      scoreTitle: "Enter score",
      scoreLead: "Player names and set scores. Saved on this device.",
      playerA: "Player A",
      playerB: "Player B",
      playerAPh: "Name",
      playerBPh: "Name",
      setScores: "Set scores",
      setN: "Set {n}",
      setGamesA: "Player A games in set {n}",
      setGamesB: "Player B games in set {n}",
      saveScore: "Save score",
      scoreHistory: "Saved scores",
      clearScores: "Clear",
      scoreEmpty: "No saved scores yet",
      scoreEmptyDesc: "Enter a match above to keep a local history.",
      scoreNeedNames: "Enter both player names",
      scoreDistinctNames: "Names must be different",
      scoreNeedSets: "Enter at least one set",
      scoreBadSets: "Use numbers like 6–4",
      scoreNeedWinner: "One side must win more sets",
      winnerLine: "Winner {name}",'''

SCORE_ZH = '''      scoreTitle: "录入比分",
      scoreLead: "填写球员名和盘分，保存在本机历史。",
      playerA: "球员 A",
      playerB: "球员 B",
      playerAPh: "姓名",
      playerBPh: "姓名",
      setScores: "盘分",
      setN: "第 {n} 盘",
      setGamesA: "球员 A 第 {n} 盘局数",
      setGamesB: "球员 B 第 {n} 盘局数",
      saveScore: "保存比分",
      scoreHistory: "本机比分",
      clearScores: "清空",
      scoreEmpty: "还没有保存的比分",
      scoreEmptyDesc: "在上方录入一场比赛后会显示在这里。",
      scoreNeedNames: "请填写两位球员姓名",
      scoreDistinctNames: "两位球员姓名不能相同",
      scoreNeedSets: "至少填写一盘比分",
      scoreBadSets: "盘分请用数字，例如 6–4",
      scoreNeedWinner: "请让某一侧赢下更多盘",
      winnerLine: "胜者 {name}",'''

def patch_friends_block(text: str, locale: str) -> str:
    score = SCORE_EN if locale == "en" else SCORE_ZH
    # Drop empty search leftovers; keep results/nearby for list counts if still referenced by older chunks
    text = text.replace('searchPh: "",\n', '')
    text = text.replace("searchPh: '',\n", '')
    text = text.replace('searchAria: "",\n', '')
    text = text.replace("searchAria: '',\n", '')
    # Insert score keys before rankTitle if missing
    if 'scoreTitle:' not in text:
        text = text.replace('      rankTitle:', score + '\n      rankTitle:')
    # UTR wording in legacy lib/messages.ts friends block
    text = text.replace(
        'Seeded from NTRP, then moved by results, opponent strength, and recent form.',
        'Ranked by a UTR-like rating, updated from match results, opponent strength, and recent form.',
    )
    text = text.replace(
        'Seed from NTRP {n} · no matches yet',
        'UTR {n} · no matches yet',
    )
    text = text.replace(
        'After the first local match, ratings move off the NTRP seed.',
        'After the first local match, ratings move off the UTR seed.',
    )
    text = text.replace(
        'Start from NTRP × 2.15.',
        'Seed = self-level × 2.15 on a UTR-like scale.',
    )
    text = text.replace(
        '先按 NTRP 定级，再按战绩、对手强度和近期比赛上下浮动。',
        '按类 UTR 分数排名，再按战绩、对手强度和近期比赛浮动。',
    )
    text = text.replace(
        'NTRP {n} 种子分 · 还没有比赛',
        'UTR {n} · 还没有比赛',
    )
    text = text.replace(
        '有了第一场本地比赛后，分数会离开 NTRP 种子分。',
        '有了第一场本地比赛后，分数会离开 UTR 种子分。',
    )
    text = text.replace(
        '起点是 NTRP × 2.15。',
        '起点是自评水平 × 2.15（类 UTR）。',
    )
    return text

root = Path('/opt/tennis-ai')
for rel, loc_hint in [('lib/messages.ts', 'both'), ('lib/i18n/messages.ts', 'both')]:
    path = root / rel
    raw = path.read_text(encoding='utf-8')
    # Patch EN friends block then ZH friends block separately by splitting on zh nav
    parts = re.split(r'(?=^\s*zh:\s*\{)', raw, maxsplit=1, flags=re.M)
    if len(parts) == 2:
        en, zh = parts
        # Only touch friends sections
        def patch_section(chunk, locale):
            m = re.search(r'(friends:\s*\{)', chunk)
            if not m:
                return chunk
            # find matching close of friends object — approximate: until \n    place:
            m2 = re.search(r'\n    place:\s*\{', chunk[m.start():])
            if not m2:
                return chunk
            start = m.start()
            end = m.start() + m2.start()
            block = chunk[start:end]
            block2 = patch_friends_block(block, locale)
            return chunk[:start] + block2 + chunk[end:]
        en2 = patch_section(en, 'en')
        zh2 = patch_section(zh, 'zh')
        out = en2 + zh2
    else:
        out = patch_friends_block(raw, 'en')
    path.write_text(out, encoding='utf-8')
    print('patched', rel)

# Sanity: no 搜索球友 / Search friends in friends messages
for rel in ['lib/messages.ts', 'lib/i18n/messages.ts', 'components/friends-view.tsx']:
    t = (root / rel).read_text(encoding='utf-8')
    for bad in ['搜索球友', '搜索球场', 'Search friends', 'Search courts']:
        if bad in t:
            print('WARN still has', bad, 'in', rel)
print('scoreTitle present', 'scoreTitle' in (root/'lib/i18n/messages.ts').read_text(encoding='utf-8'))
PY

echo "==> Rebuild Next"
cd "$ROOT"
npm run build
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai

echo "==> Quick greps"
grep -R "搜索球友\|搜索球场\|Search friends or courts" "$ROOT/components" "$ROOT/lib" 2>/dev/null | head || true
grep -n "scoreTitle\|data-score-entry" "$ROOT/components/friends-view.tsx" | head
echo "DONE $STAMP"
