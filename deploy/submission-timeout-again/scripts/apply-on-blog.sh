#!/usr/bin/env bash
# Fix submit timeout: block nav during upload + ZH-only error copy.
set -euo pipefail
APP="${APP:-/opt/tennis-ai}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.submission-timeout-again-backup-$STAMP"
mkdir -p "$BACKUP"
for f in \
  components/app-shell.tsx \
  components/analysis-view.tsx \
  components/analyze-progress.tsx \
  lib/job-watch.ts \
  lib/job-progress.ts \
  lib/i18n/translate.ts \
  lib/i18n/messages.ts
do
  cp -a "$APP/$f" "$BACKUP/" 2>/dev/null || true
done
cp -a "$ROOT/patches/app-shell.tsx" "$APP/components/app-shell.tsx"
cp -a "$ROOT/patches/analyze-progress.tsx" "$APP/components/analyze-progress.tsx"
cp -a "$ROOT/patches/job-watch.ts" "$APP/lib/job-watch.ts"
cp -a "$ROOT/patches/job-progress.ts" "$APP/lib/job-progress.ts"
cp -a "$ROOT/patches/translate.ts" "$APP/lib/i18n/translate.ts"
cp -a "$ROOT/patches/messages.ts" "$APP/lib/i18n/messages.ts"
chown -R tennis:tennis \
  "$APP/components/app-shell.tsx" \
  "$APP/components/analyze-progress.tsx" \
  "$APP/lib/job-watch.ts" \
  "$APP/lib/job-progress.ts" \
  "$APP/lib/i18n/translate.ts" \
  "$APP/lib/i18n/messages.ts" \
  "$APP/.next" || true
sudo -u tennis -H bash -lc "cd '$APP' && npm run build"
systemctl restart tennis-ai.service
systemctl is-active tennis-ai.service
echo "backup=$BACKUP"
