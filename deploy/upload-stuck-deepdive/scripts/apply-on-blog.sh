#!/usr/bin/env bash
# Apply upload-stuck client fixes on blog Next host (/opt/tennis-ai).
set -euo pipefail
APP="${APP:-/opt/tennis-ai}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.upload-stuck-deepdive-backup-$STAMP"
mkdir -p "$BACKUP"
cp -a "$APP/lib/tai.ts" "$APP/lib/trim-file.ts" "$APP/components/analysis-view.tsx" "$BACKUP/"
cp -a "$ROOT/patches/tai.ts" "$APP/lib/tai.ts"
cp -a "$ROOT/patches/trim-file.ts" "$APP/lib/trim-file.ts"
cp -a "$ROOT/patches/analysis-view.tsx" "$APP/components/analysis-view.tsx"
chown tennis:tennis "$APP/lib/tai.ts" "$APP/lib/trim-file.ts" "$APP/components/analysis-view.tsx"
sudo -u tennis -H bash -lc "cd '$APP' && npm run build"
systemctl restart tennis-ai.service
systemctl is-active tennis-ai.service
echo "backup=$BACKUP"
