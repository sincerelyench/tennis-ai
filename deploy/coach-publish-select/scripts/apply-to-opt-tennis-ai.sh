#!/usr/bin/env bash
# Apply coach publish + player select patch onto /opt/tennis-ai.
# Usage (host with SSH to 8.216.53.29, or on that host):
#   bash deploy/coach-publish-select/scripts/apply-to-opt-tennis-ai.sh /opt/tennis-ai
#
# Prefer applying AFTER coach-stroke-library (PR #7) so /library page can compose both.
# Default persona display name: 涨球教练 / Zhangqiu Coach (coordinate with rename PR #8).
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

echo "Copying publish/select sources into $ROOT …"
install -d \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/app/api/coach/publish" \
  "$ROOT/app/api/coach/train" \
  "$ROOT/app/api/coaches" \
  "$ROOT/app/api/player/coach" \
  "$ROOT/app/coaches" \
  "$ROOT/app/library" \
  "$ROOT/apps/uniapp/src/lib" \
  "$ROOT/apps/uniapp/src/pages/coach-publish" \
  "$ROOT/apps/uniapp/src/pages/coach-picker" \
  "$ROOT/.data"

cp -v "$PATCH/lib/coach-publish.ts" "$ROOT/lib/"
cp -v "$PATCH/lib/coach-publish-store.ts" "$ROOT/lib/"
cp -v "$PATCH/lib/coach-selection.ts" "$ROOT/lib/"
cp -v "$PATCH/lib/coach-library-analysis-hook.ts" "$ROOT/lib/"
cp -v "$PATCH/components/coach-publish-panel.tsx" "$ROOT/components/"
cp -v "$PATCH/components/player-coach-picker.tsx" "$ROOT/components/"
cp -v "$PATCH/app/api/coach/publish/route.ts" "$ROOT/app/api/coach/publish/"
cp -v "$PATCH/app/api/coach/train/route.ts" "$ROOT/app/api/coach/train/"
cp -v "$PATCH/app/api/coaches/route.ts" "$ROOT/app/api/coaches/"
cp -v "$PATCH/app/api/player/coach/route.ts" "$ROOT/app/api/player/coach/"
cp -v "$PATCH/app/coaches/page.tsx" "$ROOT/app/coaches/"
# Overwrites library page to include publish panel (requires stroke-library component present).
cp -v "$PATCH/app/library/page.tsx" "$ROOT/app/library/"
cp -v "$PATCH/apps/uniapp/src/lib/coach-publish.ts" "$ROOT/apps/uniapp/src/lib/"
cp -v "$PATCH/apps/uniapp/src/pages/coach-publish/coach-publish.vue" "$ROOT/apps/uniapp/src/pages/coach-publish/"
cp -v "$PATCH/apps/uniapp/src/pages/coach-picker/coach-picker.vue" "$ROOT/apps/uniapp/src/pages/coach-picker/"
cp -v "$PATCH/i18n/messages-coach-publish.snippet.ts" "$ROOT/lib/" 2>/dev/null || true
cp -v "$PATCH/NAV_PATCH.md" "$ROOT/lib/COACH_PUBLISH_NAV_PATCH.md" 2>/dev/null || true

echo
echo "Manual merge still required:"
echo "  1) Merge keys from lib/messages-coach-publish.snippet.ts into lib/i18n/messages.ts (en+zh)."
echo "  2) Player nav: href=/coaches labelKey=coaches.nav"
echo "  3) Analysis/report: resolveAnalysisCoachId + fetchCoachLibraryDemo(strokeId, coachId)"
echo "  4) Register uni-app pages coach-publish + coach-picker in pages.json"
echo "  5) Keep default display name 涨球教练 / Zhangqiu Coach (never Poppy/东东)"
echo "  6) If stroke-library patch not applied yet, apply it first or library page will miss CoachStrokeLibraryView"
echo
echo "Then:"
echo "  cd $ROOT && npm ci && npm run build && systemctl restart tennis-ai"
echo "Done copy."
