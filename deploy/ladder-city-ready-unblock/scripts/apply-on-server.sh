#!/usr/bin/env bash
# ZQ-164: unblock ladder reads stuck on cityReady=false / hung geo
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-city-ready-unblock-backup-$STAMP"
TARGET="$ROOT/components/friends-view.tsx"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components"
cp -a "$TARGET" "$BACKUP/components/" 2>/dev/null || true

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: missing $TARGET" >&2
  exit 1
fi

echo "==> Surgical ZQ-164 cityReady unblock"
python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
src = path.read_text()
if "ZQ-164: cityReady starts true" in src and "AbortSignal.timeout(2500)" in src and "onPickCity" in src:
    # idempotent if all pieces present
    if "setCityReady(true);\n    persistCityId(next)" in src or "setCityReady(true);\n    setCitySource(\"manual\")" in src:
        print("Already applied (ZQ-164 markers); skipping")
        sys.exit(0)

orig = src
changes = []

def replace_once(old: str, new: str, label: str):
    global src
    if old not in src:
        raise SystemExit(f"MISSING anchor for {label}")
    if src.count(old) != 1:
        raise SystemExit(f"Ambiguous anchor for {label}: count={src.count(old)}")
    src = src.replace(old, new, 1)
    changes.append(label)

# 1) cityReady initial true
replace_once(
    "const [cityReady, setCityReady] = useState(false);",
    "const [cityReady, setCityReady] = useState(true); // ZQ-164: cityReady starts true — do not block ladder reads on geo",
    "cityReady-init",
)

# 2) geo client timeout
replace_once(
    'const res = await fetch("/tennis/api/geo/city", { credentials: "include" });',
    'const res = await fetch("/tennis/api/geo/city", { credentials: "include", signal: AbortSignal.timeout(2500) }); // ZQ-164',
    "geo-timeout",
)

# 3) city init finally always ready
old_init = """    (async () => {
      const stored = loadStoredCityId();
      if (stored && cityOptions.some((c) => c.id === stored)) {
        if (!cancelled) {
          setCityId(stored);
          setCitySource("manual");
          setCityReady(true);
        }
        return;
      }
      const detected = await detectCityFromIp(locale);
      if (!cancelled) {
        setCityId(detected);
        setCitySource(detected ? "ip" : "default");
        setCityReady(true);
      }
    })();"""

new_init = """    (async () => {
      try {
        const stored = loadStoredCityId();
        if (stored && cityOptions.some((c) => c.id === stored)) {
          if (!cancelled) {
            setCityId(stored);
            setCitySource("manual");
          }
          return;
        }
        const detected = await detectCityFromIp(locale);
        if (!cancelled) {
          setCityId(detected);
          setCitySource(detected ? "ip" : "default");
        }
      } finally {
        // ZQ-164: always unblock ladder/city-results even if geo hangs/cancels mid-flight
        if (!cancelled) setCityReady(true);
      }
    })();"""

replace_once(old_init, new_init, "city-init-finally")

# 4) onPickCity unlocks ready
replace_once(
    """  function onPickCity(next: string) {
    setCityId(next);
    setCitySource("manual");
    persistCityId(next);
    void saveAuthProfile({ cityId: next });
  }""",
    """  function onPickCity(next: string) {
    setCityId(next);
    setCitySource("manual");
    setCityReady(true); // ZQ-164: manual city must unlock ladder fetch
    persistCityId(next);
    void saveAuthProfile({ cityId: next });
  }""",
    "onPickCity-ready",
)

if src == orig:
    raise SystemExit("no changes applied")
path.write_text(src)
print("Applied:", ", ".join(changes))
PY

echo "==> Sanity"
grep -n "ZQ-164" "$TARGET" | head -20
grep -n "cityReady starts true\|AbortSignal.timeout(2500)\|manual city must unlock" "$TARGET" | head -20

echo "==> Rebuild"
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  systemctl start tennis-ai
  sleep 3
  systemctl is-active tennis-ai
fi

echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID" 2>/dev/null || echo missing)"
curl -sf -o /dev/null -w "ladder_page:%{http_code}\n" http://127.0.0.1:43127/tennis/ladder || true
echo "DONE apply ladder-city-ready-unblock (ZQ-164; no DB writes)"
