#!/usr/bin/env bash
# Apply coach stroke-library patch onto a full Next+uni-app tree (typically /opt/tennis-ai).
# Usage (on a host with SSH to 8.216.53.29, or directly on that host):
#   bash deploy/coach-stroke-library/scripts/apply-to-opt-tennis-ai.sh /opt/tennis-ai
set -euo pipefail

ROOT="${1:-/opt/tennis-ai}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH="$HERE/opt-patch"

if [[ ! -d "$ROOT" ]]; then
  echo "Target not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "Not a tennis-ai app root (missing package.json): $ROOT" >&2
  exit 1
fi

echo "Copying library sources into $ROOT …"
install -d \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/app/api/coach/library/upload" \
  "$ROOT/app/library" \
  "$ROOT/apps/uniapp/src/lib" \
  "$ROOT/apps/uniapp/src/pages/coach-library" \
  "$ROOT/public/coach-demos" \
  "$ROOT/.data"

cp -v "$PATCH/lib/coach-stroke-library.ts" "$ROOT/lib/"
cp -v "$PATCH/lib/coach-library-analysis-hook.ts" "$ROOT/lib/"
cp -v "$PATCH/components/coach-stroke-library-view.tsx" "$ROOT/components/"
cp -v "$PATCH/app/api/coach/library/route.ts" "$ROOT/app/api/coach/library/"
cp -v "$PATCH/app/api/coach/library/upload/route.ts" "$ROOT/app/api/coach/library/upload/"
cp -v "$PATCH/app/library/page.tsx" "$ROOT/app/library/"
cp -v "$PATCH/apps/uniapp/src/lib/coach-stroke-library.ts" "$ROOT/apps/uniapp/src/lib/"
cp -v "$PATCH/apps/uniapp/src/pages/coach-library/coach-library.vue" "$ROOT/apps/uniapp/src/pages/coach-library/"
cp -v "$PATCH/i18n/messages-coach-library.snippet.ts" "$ROOT/lib/" 2>/dev/null || true

echo
echo "Manual merge still required:"
echo "  1) Merge keys from lib/messages-coach-library.snippet.ts into lib/i18n/messages.ts (en+zh)."
echo "  2) Add coach nav item href=/library labelKey=library.nav next to /students and /inbox."
echo "  3) In report/correct-form + coach chat, call fetchCoachLibraryDemo / analysisPromptInjection."
echo "  4) Register uni-app page pages/coach-library/coach-library in pages.json."
echo "  5) Keep coach display name as 涨球教练 (do not reintroduce Poppy/东东)."
echo
echo "Then as user tennis (or with correct perms):"
echo "  cd $ROOT && npm ci && npm run build && systemctl restart tennis-ai"
echo "Done copy. Review manual steps above before restart."
