#!/usr/bin/env bash
# Apply correct-video-by-issues drop-in to /opt/tennis-ai (涨球).
set -euo pipefail
ROOT="${1:-/opt/tennis-ai}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.correct-video-by-issues-backup-$STAMP"

echo "==> backup → $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/components"
for f in lib/issue-correct-demos.ts components/visual-coach.tsx lib/i18n/messages.ts; do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> copy drop-ins"
mkdir -p "$ROOT/lib" "$ROOT/components"
cp -f "$PATCH/lib/issue-correct-demos.ts" "$ROOT/lib/issue-correct-demos.ts"
cp -f "$PATCH/components/visual-coach.tsx" "$ROOT/components/visual-coach.tsx"

echo "==> merge i18n visual keys"
python3 - <<'PY' "$ROOT/lib/i18n/messages.ts"
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

EN = {
    "correctByIssuesLead": "Demos matched to your {count} problem points.",
    "demoLoading": "Loading correct-form demos…",
    "demoError": "Could not load issue demos. Showing the stroke star demo.",
}
ZH = {
    "correctByIssuesLead": "按你这次分析的 {count} 个问题点匹配正确动作示范。",
    "demoLoading": "正在加载正确动作示范…",
    "demoError": "问题点示范加载失败，先看该技术的球星示范。",
}

def upsert_visual(src: str, which: str, keys: dict) -> str:
    """which: 'en' inserts into first visual block, 'zh' into second."""
    matches = list(re.finditer(r"visual\s*:\s*\{", src))
    idx = 0 if which == "en" else 1
    if len(matches) <= idx:
        raise SystemExit(f"missing {which} visual block")
    start_brace = matches[idx].end() - 1
    depth = 0
    end = None
    for i in range(start_brace, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        raise SystemExit("unbalanced visual block")
    inner = src[start_brace + 1 : end]
    for k, v in keys.items():
        lit = '"' + v.replace('"', '\\"') + '"'
        pat = re.compile(rf"(\b{k}\s*:\s*)([`'\"])(?:\\.|(?!\2).)*\2")
        if pat.search(inner):
            inner = pat.sub(rf"\1{lit}", inner, count=1)
        elif re.search(r"\bcoachDemo\s*:", inner):
            inner = re.sub(
                r"(\bcoachDemo\s*:\s*[`'\"].*?[`'\"])",
                rf"\1,\n      {k}: {lit}",
                inner,
                count=1,
            )
        else:
            inner = inner.rstrip() + f",\n      {k}: {lit}\n"
    return src[: start_brace + 1] + inner + src[end:]

text = upsert_visual(text, "en", EN)
text = upsert_visual(text, "zh", ZH)
path.write_text(text, encoding="utf-8")
print("messages.ts visual keys merged")
PY

echo "==> next build"
cd "$ROOT"
if [[ -f package.json ]]; then
  npm run build
  systemctl restart tennis-ai || true
fi
echo "==> apply-on-server done"
