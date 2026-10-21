#!/usr/bin/env bash
# Apply GPU /tai static UI without 分析预览 (e1 + index + i18n).
# Does NOT touch auth / stroke passthrough / web/app.py.
#
# Usage on 47.93.203.28:
#   bash deploy/remove-analyze-preview/scripts/apply-gpu.sh /root/workspace/tennis-ai
set -euo pipefail

ROOT="${1:-${GPU_TAI_ROOT:-/root/workspace/tennis-ai}}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
GPU="$HERE/gpu-patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.remove-analyze-preview-gpu-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "GPU root not found: $ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "GPU backup -> $BACKUP"

copy_bak() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    local rel="${dest#"$ROOT"/}"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$dest" "$BACKUP/$rel"
  fi
  install -D -m 0644 "$src" "$dest"
  echo "  + $dest"
}

copy_bak "$GPU/web/static/index.html" "$ROOT/web/static/index.html"
copy_bak "$GPU/web/static/e1.js" "$ROOT/web/static/e1.js"
copy_bak "$GPU/web/static/e1.css" "$ROOT/web/static/e1.css"
copy_bak "$GPU/web/static/e1.html" "$ROOT/web/static/e1.html"
copy_bak "$GPU/i18n/zh-CN.json" "$ROOT/i18n/zh-CN.json"
copy_bak "$GPU/i18n/en.json" "$ROOT/i18n/en.json"

# Soft scrub any leftover 分析预览 in GPU static
python3 - "$ROOT" <<'PY'
import sys
from pathlib import Path
root = Path(sys.argv[1])
drop = ["分析预览", "Analysis preview", "上传后这里会显示你的录像预览"]
files = list((root / "web/static").glob("*.html"))
files += list((root / "web/static").glob("*.js"))
files += list((root / "web/static").glob("*.css"))
files += list((root / "i18n").glob("*.json"))
for p in files:
  try:
    t = p.read_text(encoding="utf-8")
  except Exception:
    continue
  n = t
  for s in drop:
    n = n.replace(s, "")
  if n != t:
    p.write_text(n, encoding="utf-8")
    print("  ~ scrubbed", p)
PY

if systemctl list-unit-files 2>/dev/null | grep -q '^tennis-ai'; then
  systemctl restart tennis-ai || true
elif [[ -x "$ROOT/run_web.sh" ]]; then
  echo "  (no systemd unit; restart /tai manually if needed)"
fi

# Negative check
if rg -n '分析预览' "$ROOT/web/static" "$ROOT/i18n" 2>/dev/null; then
  echo "WARN: 分析预览 still present under GPU tree" >&2
else
  echo "OK: no 分析预览 in GPU static/i18n"
fi

echo "DONE GPU apply-gpu on $ROOT"
