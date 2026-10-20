#!/usr/bin/env bash
# 涨球 · report four-dim + speed — apply on 8.216.53.29 (/opt/tennis-ai)
# Surfaces: Next web + uni-app (APK H5 / iOS www) + mp-weixin sources when present.
#
# Usage:
#   bash deploy/report-four-dim/scripts/apply-on-server.sh /opt/tennis-ai
# Prefer Mac wrapper: scripts/mac-four-surface-release.sh
set -euo pipefail

ROOT="${1:-${TENNIS_AI_ROOT:-/opt/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"
UNI="$HERE/uniapp-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.report-four-dim-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"

copy_bak() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    local rel
    rel="$(realpath --relative-to="$ROOT" "$dest" 2>/dev/null || echo "$dest")"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$dest" "$BACKUP/$rel"
  fi
  install -D -m 0644 "$src" "$dest"
  echo "  + $dest"
}

echo "==> 1/4 drop-in Next + uni-app components"
COMP=""
LIB=""
for d in "$ROOT/components" "$ROOT/apps/web/components" "$ROOT/src/components"; do
  [[ -d "$d" ]] && COMP="$d" && break
done
for d in "$ROOT/lib" "$ROOT/apps/web/lib" "$ROOT/src/lib"; do
  [[ -d "$d" ]] && LIB="$d" && break
done
[[ -n "$COMP" ]] || { echo "no components/ dir" >&2; exit 1; }
[[ -n "$LIB" ]] || { echo "no lib/ dir" >&2; exit 1; }

copy_bak "$PATCH/components/report-four-dim.tsx" "$COMP/report-four-dim.tsx"
copy_bak "$PATCH/lib/report-four-dim.ts" "$LIB/report-four-dim.ts"
copy_bak "$PATCH/lib/REPORT_FOUR_DIM_WIRE.md" "$LIB/REPORT_FOUR_DIM_WIRE.md"

UNI_SRC=""
for d in "$ROOT/apps/uniapp" "$ROOT/uniapp" "$ROOT/apps/tennis-uniapp"; do
  [[ -d "$d" ]] && UNI_SRC="$d" && break
done
if [[ -n "$UNI_SRC" ]]; then
  DEST_COMP=""
  for d in "$UNI_SRC/src/components" "$UNI_SRC/components"; do
    [[ -d "$d" || -d "$(dirname "$d")" ]] && DEST_COMP="$d" && break
  done
  if [[ -n "$DEST_COMP" ]]; then
    mkdir -p "$DEST_COMP"
    copy_bak "$UNI/components/report-four-dim.vue" "$DEST_COMP/report-four-dim.vue"
  fi
fi

echo "==> 2/4 soft-wire ReportFourDim into report pages"
python3 - "$ROOT" "$BACKUP" <<'PY'
import pathlib, re, shutil, sys

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
MARKER = "data-zq-four-dim"
IMPORT_LINE = 'import { ReportFourDim } from "@/components/report-four-dim";'
IMPORT_ALT = "import { ReportFourDim } from '@/components/report-four-dim';"

def bak(p: pathlib.Path) -> None:
    rel = p.relative_to(root)
    dest = backup / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        shutil.copy2(p, dest)

candidates = []
for pat in (
    "**/report/**/page.tsx",
    "**/report/**/Report*.tsx",
    "**/components/**/report*.tsx",
    "**/components/**/score*.tsx",
):
    candidates.extend(root.glob(pat))

# Prefer pages that already mention axis scores / 分项
picked = []
for p in candidates:
    if not p.is_file():
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue
    if MARKER in text and "ReportFourDim" in text:
        print(f"  · already wired: {p}")
        continue
    hit = any(
        tok in text
        for tok in (
            "parseAxisScores",
            "report.axis.weight",
            "分项得分",
            "axis.weight",
            "overall?.scores",
            "overall.scores",
        )
    )
    if hit:
        picked.append(p)

if not picked:
    # Fallback: any report/[id]/page.tsx
    picked = [p for p in root.glob("**/report/[id]/page.tsx") if p.is_file()]
    picked += [p for p in root.glob("**/report/**/page.tsx") if p.is_file()]

seen = set()
for path in picked:
    key = str(path.resolve())
    if key in seen:
        continue
    seen.add(key)
    text = path.read_text(encoding="utf-8")
    if MARKER in text and "ReportFourDim" in text:
        continue
    orig = text
    if "ReportFourDim" not in text:
        # insert import after first import block
        m = re.search(r"(^import .+?;\n)", text, re.M)
        if m:
            # find last consecutive import
            pos = 0
            last = None
            for m in re.finditer(r"^import .+?;\n", text, re.M):
                if last is None or m.start() == last.end():
                    last = m
                elif m.start() > (last.end() if last else 0) + 1:
                    break
                else:
                    last = m
            if last:
                text = text[: last.end()] + IMPORT_LINE + "\n" + text[last.end() :]
            else:
                text = IMPORT_LINE + "\n" + text
        else:
            text = IMPORT_LINE + "\n" + text

    inject = (
        '\n      <ReportFourDim report={(typeof report !== "undefined" ? report : null) '
        '|| (typeof data !== "undefined" ? data?.report || data : null) '
        '|| (typeof taiReport !== "undefined" ? taiReport : null)} />\n'
    )
    if MARKER not in text:
        # Try to place before breakdown table / after score header
        placed = False
        for needle in (
            "分项得分",
            "Breakdown",
            "report.axisCol",
            "parseAxisScores(",
            "axis.weight",
        ):
            idx = text.find(needle)
            if idx < 0:
                continue
            # walk back to a JSX open-ish line
            line_start = text.rfind("\n", 0, idx)
            text = text[:line_start] + inject + text[line_start:]
            placed = True
            break
        if not placed:
            # append near end of first return (
            m = re.search(r"return\s*\(\s*<", text)
            if m:
                # insert after opening fragment/div of return
                gt = text.find(">", m.end() - 1)
                if gt > 0:
                    text = text[: gt + 1] + inject + text[gt + 1 :]
                    placed = True
        if not placed:
            print(f"  ! could not auto-place in {path}; component copied only")
            continue

    if text != orig:
        bak(path)
        path.write_text(text, encoding="utf-8")
        print(f"  + wired {path}")

# uni-app report vue soft-wire
for uni in list(root.glob("**/pages/**/report*.vue")) + list(root.glob("**/pages/**/result*.vue")):
    try:
        text = uni.read_text(encoding="utf-8")
    except Exception:
        continue
    if "report-four-dim" in text or "ReportFourDim" in text:
        print(f"  · uni already: {uni}")
        continue
    if not any(tok in text for tok in ("scores", "分项", "overall", "击球点")):
        continue
    orig = text
    if 'import ReportFourDim' not in text and 'report-four-dim' not in text:
        # easy path: add component tag near scores
        if "<template>" in text and "report-four-dim" not in text:
            text = text.replace(
                "<template>",
                "<template>\n  <!-- zq four-dim injected -->\n",
                1,
            )
            # insert after first view in template
            m = re.search(r"(<template>\s*<view[^>]*>)", text, re.I)
            if m:
                text = (
                    text[: m.end()]
                    + '\n    <report-four-dim :report="report || detail || result || null" :scores="(report && report.overall && report.overall.scores) || scores || null" />\n'
                    + text[m.end() :]
                )
    if text != orig:
        bak(uni)
        uni.write_text(text, encoding="utf-8")
        print(f"  + uni wired {uni}")
PY

echo "==> 3/4 rebuild Next"
if id tennis &>/dev/null; then
  sudo -u tennis bash -lc "cd '$ROOT' && npm run build"
else
  (cd "$ROOT" && npm run build)
fi
systemctl restart tennis-ai 2>/dev/null || systemctl restart tennis-web 2>/dev/null || true

echo "==> 4/4 optional uni rebuild hints"
if [[ -n "${UNI_SRC:-}" && -f "$UNI_SRC/package.json" ]]; then
  echo "  uni-app at $UNI_SRC — rebuild mp/app on Mac via mac-four-surface-release.sh"
fi

# Preview static
if [[ -d "$ROOT/public" && -f "$HERE/preview/index.html" ]]; then
  install -D -m 0644 "$HERE/preview/index.html" "$ROOT/public/report-four-dim-preview.html"
  echo "  + /report-four-dim-preview.html"
fi

echo DONE
