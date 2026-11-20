#!/usr/bin/env bash
# ZQ-164d: SSR-seed ladder + 约球 so WeChat first paint is not stuck empty.
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-ssr-seed-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/app/(main)/ladder" "$BACKUP/app/(main)/friends" "$BACKUP/lib" "$BACKUP/components"
cp -a "$ROOT/app/(main)/ladder/page.tsx" "$BACKUP/app/(main)/ladder/" 2>/dev/null || true
cp -a "$ROOT/app/(main)/friends/page.tsx" "$BACKUP/app/(main)/friends/" 2>/dev/null || true
cp -a "$ROOT/lib/friends-ssr-seed.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/components/friends-view.tsx" "$BACKUP/components/" 2>/dev/null || true

echo "==> Copy SSR seed lib + pages"
cp -a "$PATCH_DIR/opt-patch/lib/friends-ssr-seed.ts" "$ROOT/lib/friends-ssr-seed.ts"
cp -a "$PATCH_DIR/opt-patch/app/(main)/ladder/page.tsx" "$ROOT/app/(main)/ladder/page.tsx"
cp -a "$PATCH_DIR/opt-patch/app/(main)/friends/page.tsx" "$ROOT/app/(main)/friends/page.tsx"

echo "==> Surgical FriendsView props + initial state (ZQ-164d)"
python3 - "$ROOT/components/friends-view.tsx" <<'PY'
from pathlib import Path
import sys

target = Path(sys.argv[1])
src = target.read_text()
if "ZQ-164d" in src and "initialLadderRows" in src:
    print("Already applied (ZQ-164d marker present); skipping FriendsView patch")
    sys.exit(0)

old_sig = 'export function FriendsView({ surface = "match" }: { surface?: "match" | "ladder" }) {'
new_sig = '''export function FriendsView({
  surface = "match",
  initialCityId = null,
  initialLadderRows = null,
  initialSuccessRecords = null,
}: {
  surface?: "match" | "ladder";
  /** ZQ-164d: SSR-seeded city so first paint matches seeded ladder. */
  initialCityId?: string | null;
  initialLadderRows?: LadderApiRow[] | null;
  initialSuccessRecords?: MatchIntroRow[] | null;
}) {'''
if old_sig not in src:
    raise SystemExit("FriendsView signature not found")
src = src.replace(old_sig, new_sig, 1)

old_city = "  const [cityId, setCityId] = useState<string>(DEFAULT_CITY_ID);"
new_city = "  const [cityId, setCityId] = useState<string>(() => initialCityId || DEFAULT_CITY_ID); // ZQ-164d"
if old_city not in src:
    raise SystemExit("cityId useState not found")
src = src.replace(old_city, new_city, 1)

old_rows = "  const [ladderRows, setLadderRows] = useState<LadderApiRow[]>([])"
new_rows = "  const [ladderRows, setLadderRows] = useState<LadderApiRow[]>(() =>\n    Array.isArray(initialLadderRows) ? initialLadderRows : [],\n  ) // ZQ-164d"
# keep semicolon style of original
if "  const [ladderRows, setLadderRows] = useState<LadderApiRow[]>([]);" not in src:
    raise SystemExit("ladderRows useState not found")
src = src.replace(
    "  const [ladderRows, setLadderRows] = useState<LadderApiRow[]>([]);",
    "  const [ladderRows, setLadderRows] = useState<LadderApiRow[]>(() =>\n    Array.isArray(initialLadderRows) ? initialLadderRows : [],\n  ); // ZQ-164d",
    1,
)

if "  const [ladderFromApi, setLadderFromApi] = useState(false);" not in src:
    raise SystemExit("ladderFromApi useState not found")
src = src.replace(
    "  const [ladderFromApi, setLadderFromApi] = useState(false);",
    "  const [ladderFromApi, setLadderFromApi] = useState(() => initialLadderRows != null); // ZQ-164d",
    1,
)

if "  const [successRecords, setSuccessRecords] = useState<MatchIntroRow[]>([]);" not in src:
    raise SystemExit("successRecords useState not found")
src = src.replace(
    "  const [successRecords, setSuccessRecords] = useState<MatchIntroRow[]>([]);",
    "  const [successRecords, setSuccessRecords] = useState<MatchIntroRow[]>(() =>\n    Array.isArray(initialSuccessRecords) ? initialSuccessRecords : [],\n  ); // ZQ-164d",
    1,
)

# Prove SSR seed in DOM for Network/devtools verification
needle = 'data-ladder-from-api={ladderFromApi ? "true" : "false"} data-ladder-count={ladder.length}'
repl = (
    'data-ladder-from-api={ladderFromApi ? "true" : "false"} '
    'data-ladder-count={ladder.length} '
    'data-ladder-ssr-seed={initialLadderRows != null ? "true" : "false"}'
)
if needle not in src:
    raise SystemExit("data-ladder-count attribute not found")
src = src.replace(needle, repl, 1)

# Match success list marker
mneedle = 'data-match-success-list="true" data-match-success-db-fidelity="true"'
mrepl = 'data-match-success-list="true" data-match-success-db-fidelity="true" data-match-ssr-seed={initialSuccessRecords != null ? "true" : "false"} data-match-success-count={successRecords.length}'
if mneedle not in src:
    raise SystemExit("match-success-list marker not found")
src = src.replace(mneedle, mrepl, 1)

if "ZQ-164d" not in src:
    raise SystemExit("post-patch missing ZQ-164d")
target.write_text(src)
print(f"Patched {target}")
PY

echo "==> Sanity"
grep -n "ZQ-164d\|initialLadderRows\|friends-ssr-seed\|data-ladder-ssr-seed" \
  "$ROOT/components/friends-view.tsx" \
  "$ROOT/app/(main)/ladder/page.tsx" \
  "$ROOT/app/(main)/friends/page.tsx" \
  "$ROOT/lib/friends-ssr-seed.ts" | head -40

echo "==> Rebuild"
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  sudo -u tennis npm run build
  systemctl start tennis-ai
fi

echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"
echo "DONE ZQ-164d ladder-ssr-seed backup=$BACKUP"
