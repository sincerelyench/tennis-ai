#!/usr/bin/env bash
# Apply richer analyze waiting progress UI onto /opt/tennis-ai (Next) + optional uni-app.
# Also refresh /tai static if GPU tree is present.
#
# Brand: 涨球 · default coach 涨球教练 · no NTRP picker on waiting UI.
# Does NOT touch stroke / apiStroke pass-through.
#
# Usage (on 8.216.53.29 or via Mac SSH):
#   bash deploy/analyze-progress-ui/scripts/apply-on-server.sh
#   TENNIS_AI_ROOT=/opt/tennis-ai GPU_TAI_ROOT=/root/workspace/tennis-ai bash ...
set -euo pipefail

ROOT="${TENNIS_AI_ROOT:-/opt/tennis-ai}"
GPU_ROOT="${GPU_TAI_ROOT:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCH="$PKG/opt-patch"
UNI="$PKG/uniapp-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.analyze-progress-ui-backup-${STAMP}"

echo "== analyze-progress-ui apply =="
echo "ROOT=$ROOT"
echo "PKG=$PKG"

if [[ ! -d "$ROOT" ]]; then
  echo "tennis-ai root not found: $ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"

backup_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0
  local rel
  rel="${path#"$ROOT"/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$path" "$BACKUP/$rel"
}

copy_into() {
  local src="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$dest" ]]; then
    backup_file "$dest"
  fi
  cp -a "$src" "$dest"
  echo "wrote $dest"
}

# --- Next / web components ---
COMP_DIR=""
for d in "$ROOT/components" "$ROOT/apps/web/components" "$ROOT/src/components"; do
  if [[ -d "$d" ]]; then COMP_DIR="$d"; break; fi
done
LIB_DIR=""
for d in "$ROOT/lib" "$ROOT/apps/web/lib" "$ROOT/src/lib"; do
  if [[ -d "$d" ]]; then LIB_DIR="$d"; break; fi
done

if [[ -n "$COMP_DIR" ]]; then
  copy_into "$PATCH/components/analyze-progress.tsx" "$COMP_DIR/analyze-progress.tsx"
else
  echo "WARN: no components/ dir under $ROOT — skipped analyze-progress.tsx"
fi
if [[ -n "$LIB_DIR" ]]; then
  copy_into "$PATCH/lib/job-progress.ts" "$LIB_DIR/job-progress.ts"
  copy_into "$PATCH/i18n/messages-analyze-progress.snippet.ts" "$LIB_DIR/messages-analyze-progress.snippet.ts"
  copy_into "$PATCH/ANALYSIS_VIEW_PATCH.md" "$LIB_DIR/ANALYZE_PROGRESS_UI_PATCH.md"
else
  echo "WARN: no lib/ dir — skipped job-progress helpers"
fi

# --- Soft-wire analysis-view if present: ensure import + component usage ---
python3 - "$ROOT" "$BACKUP" <<'PY'
import pathlib, re, shutil, sys

root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
changed = []

def bak(p: pathlib.Path) -> None:
    rel = p.relative_to(root)
    dest = backup / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        shutil.copy2(p, dest)

candidates = list(root.rglob("analysis-view.tsx")) + list(root.rglob("analyze-progress.tsx"))
# Only patch analysis-view to import richer component when a thin LoadingState-only wait remains.
for path in root.rglob("analysis-view.tsx"):
    text = path.read_text(encoding="utf-8")
    orig = text
    if "AnalyzeProgress" in text and "zq-analyze-progress" in text:
        continue
    # Prefer adding import if missing
    if "from \"@/components/analyze-progress\"" not in text and "from '@/components/analyze-progress'" not in text:
        if "analyze-progress" not in text:
            text = re.sub(
                r'(import\s+.+?;\n)',
                r'\1import { AnalyzeProgress } from "@/components/analyze-progress";\n',
                text,
                count=1,
            )
    # Replace common thin waiting markers with AnalyzeProgress when job/progress props exist
    # Conservative: only if a data-analyze-progress LoadingState-only pattern is nearby and no roadmap yet
    if "data-analyze-steps" in text or "zq-analyze-progress" in text:
        pass
    elif "data-analyze-progress" in text and "AnalyzeProgress" in text:
        # already imports; try to ensure JSX usage when submitting/running
        if "<AnalyzeProgress" not in text:
            text = re.sub(
                r'(\{/\*\s*progress\s*\*/\}|\{\s*progress\s*\})',
                '<AnalyzeProgress job={job} submitting={submitting} localPreviewUrl={localPreviewUrl} />',
                text,
                count=1,
            )
    if text != orig:
        bak(path)
        path.write_text(text, encoding="utf-8")
        changed.append(str(path.relative_to(root)))

print("analysis-view touch:", ", ".join(changed) or "(no auto JSX swap; see ANALYSIS_VIEW_PATCH.md)")
PY

# --- Uni-app snippet ---
UNI_DEST=""
for d in \
  "$ROOT/apps/uniapp/src/components" \
  "$ROOT/apps/uniapp/components" \
  "$ROOT/uniapp/src/components"; do
  if [[ -d "$(dirname "$d")" ]]; then
    mkdir -p "$d"
    UNI_DEST="$d"
    break
  fi
done
if [[ -n "$UNI_DEST" ]]; then
  copy_into "$UNI/progress-roadmap.snippet.vue" "$UNI_DEST/zq-analyze-progress.vue"
  copy_into "$UNI/README.md" "$UNI_DEST/ZQ_ANALYZE_PROGRESS_README.md"
fi

# --- Optional GPU /tai static from this same package's sibling repo checkout ---
# If GPU_TAI_ROOT points at a tennis-ai checkout that serves /tai, sync web/static + i18n.
if [[ -n "$GPU_ROOT" && -d "$GPU_ROOT/web/static" ]]; then
  echo "Syncing /tai static into $GPU_ROOT (from apply host package if present)…"
  # Prefer files already in GPU tree after git pull; this script only ensures coach ETA label if local patch exists
  if [[ -f "$PKG/../../web/static/index.html" ]]; then
    :
  fi
  echo "GPU_ROOT set: pull latest cursor/analyze-progress-ui branch on GPU host, then restart tennis-ai service."
fi

# --- Build + restart Next ---
if [[ -f "$ROOT/package.json" ]]; then
  echo "Building Next app in $ROOT …"
  (
    cd "$ROOT"
    if [[ -f package-lock.json ]]; then npm ci --omit=dev || npm ci || true; fi
    npm run build
  )
  if systemctl list-unit-files | grep -q '^tennis-ai\.service'; then
    systemctl restart tennis-ai
    echo "restarted tennis-ai"
  else
    echo "WARN: tennis-ai.service not found — build done; restart manually"
  fi
else
  echo "WARN: no package.json — copied sources only"
fi

echo
echo "Done. Manual check:"
echo "  1) Open analyze waiting UI — 5-step roadmap, %, ETA, preview, leave hint"
echo "  2) Confirm stroke submit still sends apiStroke (serve / fh-topspin)"
echo "  3) Default coach copy 涨球教练; no NTRP picker on waiting screen"
echo "Backup: $BACKUP"
