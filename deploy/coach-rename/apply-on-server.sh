#!/usr/bin/env bash
# Apply 掌球教练 / Zhangqiu Coach rename on the production Next host.
# Run on 8.216.53.29 (or via SSH) as root. Does not rename product 涨球.
# Internal coach id "poppy" is left unchanged.
set -euo pipefail

ROOT="${TENNIS_AI_ROOT:-/opt/tennis-ai}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAP="${SCRIPT_DIR}/replacements.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.coach-rename-backup-${STAMP}"

if [[ ! -f "$MAP" ]]; then
  echo "missing replacements.json at $MAP" >&2
  exit 1
fi
if [[ ! -d "$ROOT" ]]; then
  echo "tennis-ai root not found: $ROOT" >&2
  exit 1
fi

python3 - "$ROOT" "$MAP" "$BACKUP" <<'PY'
import json, sys, pathlib, shutil
root = pathlib.Path(sys.argv[1])
pairs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
backup = pathlib.Path(sys.argv[3])
backup.mkdir(parents=True, exist_ok=True)

# Prefer source message / coach files if present; always patch built chunks too.
globs = [
    "**/messages/**/*.{json,ts,tsx,js}",
    "**/locales/**/*.{json,ts,tsx,js}",
    "**/i18n/**/*.{json,ts,tsx,js}",
    "**/*coach*.{ts,tsx,js,json}",
    "**/.next/static/chunks/*.js",
    "**/apps/web/.next/static/chunks/*.js",
]
# pathlib glob doesn't expand brace sets — expand manually
patterns = []
for g in globs:
    if "{json,ts,tsx,js}" in g:
        for ext in ("json", "ts", "tsx", "js"):
            patterns.append(g.replace("{json,ts,tsx,js}", ext))
    else:
        patterns.append(g)

seen = set()
files = []
for pat in patterns:
    for p in root.glob(pat):
        if p.is_file() and p not in seen:
            seen.add(p)
            files.append(p)

changed = []
for path in files:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if not any(old in text for old, _ in pairs):
        continue
    new = text
    for old, repl in pairs:
        new = new.replace(old, repl)
    if new == text:
        continue
    rel = path.relative_to(root)
    dest = backup / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)
    path.write_text(new, encoding="utf-8")
    changed.append(str(rel))

print(f"patched {len(changed)} files; backup {backup}")
for c in changed[:50]:
    print(" ", c)
if len(changed) > 50:
    print(f"  … +{len(changed)-50} more")
if not changed:
    sys.exit(2)
PY

# If full source tree exists, rebuild; otherwise patched chunks are enough for current buildId.
if [[ -f "$ROOT/package.json" ]] && grep -q '"build"' "$ROOT/package.json"; then
  if id tennis >/dev/null 2>&1; then
    echo "rebuilding as tennis…"
    su -s /bin/bash tennis -c "cd '$ROOT' && npm run build"
  else
    echo "user tennis missing; skip rebuild (chunks already patched)"
  fi
fi

if systemctl list-unit-files tennis-ai.service >/dev/null 2>&1; then
  systemctl restart tennis-ai
  systemctl --no-pager --full status tennis-ai | head -20
fi

echo "done. Spot-check: login then view /tennis/coach — expect 掌球教练 / Zhangqiu Coach, no Poppy/东东教练."
