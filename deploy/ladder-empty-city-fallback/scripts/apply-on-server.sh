#!/usr/bin/env bash
# ZQ-163: ladder empty-city fallback — mirror prod hotpatch
# (city empty → DEFAULT_CITY_ID/wuxi → unscoped; persist city).
# Surgical: replaces only refreshLadder in live friends-view.tsx.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-empty-city-fallback-backup-$STAMP"
TARGET="$ROOT/components/friends-view.tsx"
SNIPPET="$PATCH_DIR/opt-patch/refresh-ladder.snippet.tsx"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components"
cp -a "$TARGET" "$BACKUP/components/" 2>/dev/null || true

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: missing $TARGET" >&2
  exit 1
fi
if [[ ! -f "$SNIPPET" ]]; then
  echo "ERROR: missing $SNIPPET" >&2
  exit 1
fi

echo "==> Surgical replace refreshLadder (ZQ-163)"
python3 - "$TARGET" "$SNIPPET" <<'PY'
import re, sys
from pathlib import Path

target = Path(sys.argv[1])
snippet = Path(sys.argv[2]).read_text()
if "ZQ-163" not in snippet:
    raise SystemExit("snippet missing ZQ-163 marker")
src = target.read_text()
if "ZQ-163: empty city filter" in src and "fetchLadderRows" in src:
    print("Already applied (ZQ-163 marker present); skipping replace")
    sys.exit(0)

pat = re.compile(
    r"  async function refreshLadder\(\) \{.*?\n  \}\n(?=\n  async function refreshScores)",
    re.S,
)
m = pat.search(src)
if not m:
    raise SystemExit("refreshLadder block not found — refuse to overwrite whole file")

# snippet file is the function body only (no trailing blank before refreshScores)
repl = snippet.rstrip() + "\n"
out = pat.sub(repl, src, count=1)
if out == src:
    raise SystemExit("replace produced no change")
if "ZQ-163: empty city filter" not in out:
    raise SystemExit("post-replace missing ZQ-163 marker")
target.write_text(out)
print(f"Patched {target} ({m.start()}:{m.end()} → +{len(repl)} chars)")
PY

echo "==> Sanity"
grep -n "ZQ-163: empty city filter" "$TARGET" | head -3
grep -n "DEFAULT_CITY_ID" "$TARGET" | head -5
grep -n "persistCityId(DEFAULT_CITY_ID)" "$TARGET" | head -3

echo "==> Prefer atomic rebuild if present"
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  echo "atomic-next-rebuild.sh missing — stop/build/start manually"
  systemctl stop tennis-ai || true
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  if command -v pnpm >/dev/null 2>&1; then
    sudo -u tennis pnpm build || sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  else
    sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  fi
  systemctl start tennis-ai
  sleep 3
  systemctl is-active tennis-ai
fi

echo "==> Smoke"
curl -sf -o /dev/null -w "ladder_page:%{http_code}\n" http://127.0.0.1:43127/tennis/ladder || true
test -f "$ROOT/.next/BUILD_ID" && echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"
echo "DONE apply ladder-empty-city-fallback (ZQ-163; no DB writes)"
