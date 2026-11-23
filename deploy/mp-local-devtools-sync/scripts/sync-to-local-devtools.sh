#!/usr/bin/env bash
# Default deliverable: Yanqing WeChat DevTools project (not zip-only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${SRC:-$ROOT/project}"
DEST="${LOCAL_MP_DIR:-/Users/yanqing/Downloads/mp-weixin}"

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: missing project mirror at $SRC" >&2
  exit 1
fi

if [[ ! -d "$DEST" ]]; then
  echo "DEST not found: $DEST"
  echo "This machine has no Mac DevTools path. Options:"
  echo "  1) On Mac: pull branch, then run this script (directory must exist)"
  echo "  2) Start Cursor Mac worker (agent worker start) then re-run from cloud"
  echo "  3) Manual: copy contents of $SRC into \"$DEST\""
  exit 2
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$DEST/.zq-sync-backup-$STAMP"
mkdir -p "$BACKUP"
cp -a "$DEST/app.json" "$BACKUP/" 2>/dev/null || true
cp -a "$DEST/pages" "$BACKUP/pages" 2>/dev/null || true

echo "==> Sync $SRC -> $DEST"
rsync -a \
  --exclude '.zq-sync-backup-*' \
  --exclude 'project.private.config.json' \
  --exclude 'node_modules' \
  "$SRC"/ "$DEST"/

python3 - "$DEST" <<'PY'
import json, sys
from pathlib import Path
root=Path(sys.argv[1])
pages=json.loads((root/"app.json").read_text())["pages"]
assert pages[0]=="pages/home/home", pages[0]
w=(root/"pages/login/login.wxml").read_text()
assert "微信登录" not in w
assert "data-legal-consent" in w
print("LOCAL_DEVTOOLS_SYNC_OK", root)
PY
echo "DONE synced to $DEST — DevTools: 清缓存并编译"
