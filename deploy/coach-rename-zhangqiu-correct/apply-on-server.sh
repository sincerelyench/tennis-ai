#!/usr/bin/env bash
# Correct default coach display: 掌球教练 → 涨球教练 / Zhangqiu Coach.
# Also strips leftover Poppy / 东东教练 / Coach Dongdong / Palm Ball Coach.
# Product brand 涨球 is unchanged. Internal coach id "poppy" is left unchanged.
# Run on 8.216.53.29 (or via Mac SSH) as root.
set -euo pipefail

ROOT="${TENNIS_AI_ROOT:-/opt/tennis-ai}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAP="${SCRIPT_DIR}/replacements.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.coach-rename-zhangqiu-correct-backup-${STAMP}"

if [[ ! -f "$MAP" ]]; then
  echo "missing replacements.json at $MAP" >&2
  exit 1
fi
if [[ ! -d "$ROOT" ]]; then
  echo "tennis-ai root not found: $ROOT" >&2
  exit 1
fi

python3 - "$ROOT" "$MAP" "$BACKUP" <<'PY'
import json, re, sys, pathlib, shutil, zipfile, io

root = pathlib.Path(sys.argv[1])
pairs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
backup = pathlib.Path(sys.argv[3])
backup.mkdir(parents=True, exist_ok=True)

patterns = [
  "**/messages/**/*.json", "**/messages/**/*.ts", "**/messages/**/*.tsx", "**/messages/**/*.js",
  "**/locales/**/*.json", "**/locales/**/*.ts", "**/locales/**/*.tsx", "**/locales/**/*.js",
  "**/i18n/**/*.json", "**/i18n/**/*.ts", "**/i18n/**/*.tsx", "**/i18n/**/*.js",
  "**/*coach*.ts", "**/*coach*.tsx", "**/*coach*.js", "**/*coach*.json", "**/*coach*.vue",
  "**/messages.ts", "**/messages.js",
  "**/.next/static/chunks/*.js",
  "**/apps/web/.next/static/chunks/*.js",
  "**/apps/uniapp/**/*.ts", "**/apps/uniapp/**/*.tsx", "**/apps/uniapp/**/*.js", "**/apps/uniapp/**/*.vue",
  "**/components/**/*coach*",
  "**/lib/**/*coach*",
  "**/pages/**/*coach*",
  "**/preview/**/*.html",
]

# Public download / ship pages (outside or inside ROOT)
extra_globs = [
  pathlib.Path("/var/www/html/get-zhangqiu.html"),
  pathlib.Path("/usr/share/nginx/html/get-zhangqiu.html"),
  pathlib.Path("/opt/tennis-ai/public/get-zhangqiu.html"),
  pathlib.Path("/opt/tennis-ai/deploy/ship/get-zhangqiu.html"),
  pathlib.Path("/www/wwwroot/yqchen.blog/get-zhangqiu.html"),
]
for cand in (
  pathlib.Path("/var/www"),
  pathlib.Path("/www/wwwroot"),
  pathlib.Path("/opt"),
):
  if cand.is_dir():
    extra_globs.extend(cand.glob("**/get-zhangqiu.html"))
    extra_globs.extend(cand.glob("**/mp-weixin-README.txt"))

seen = set()
files = []
for pat in patterns:
  for p in root.glob(pat):
    if p.is_file() and p not in seen:
      s = str(p)
      if "/node_modules/" in s or "/.git/" in s:
        continue
      seen.add(p)
      files.append(p)

for p in extra_globs:
  if p.is_file() and p not in seen:
    seen.add(p)
    files.append(p)

# Also patch any HTML under ROOT that mentions the wrong coach name
for p in root.rglob("*.html"):
  if p.is_file() and p not in seen:
    s = str(p)
    if "/node_modules/" in s or "/.git/" in s:
      continue
    try:
      t = p.read_text(encoding="utf-8")
    except Exception:
      continue
    if "掌球教练" in t or "Poppy" in t or "东东" in t or "Palm Ball" in t:
      seen.add(p)
      files.append(p)

changed = []
banned_after = ("掌球教练", "Palm Ball Coach", "东东教练", "Coach Dongdong")


def backup_file(path: pathlib.Path) -> None:
  try:
    rel = path.relative_to(root)
  except ValueError:
    rel = pathlib.Path("_outside") / path.name
  dest = backup / rel
  dest.parent.mkdir(parents=True, exist_ok=True)
  if not dest.exists():
    shutil.copy2(path, dest)


def apply_pairs(text: str) -> str:
  new = text
  for old, repl in pairs:
    new = new.replace(old, repl)
  # Source-safe roster leftovers
  new = re.sub(
    r'name:\s*"Poppy"(\s*,\s*\n\s*short:\s*")Zhangqiu Coach"',
    r'name: "Zhangqiu Coach"\1Zhangqiu Coach"',
    new,
  )
  new = re.sub(
    r'name:\s*"Poppy"(\s*,\s*\n\s*short:\s*")(?:掌球教练|涨球教练)"',
    r'name: "涨球教练"\1涨球教练"',
    new,
  )
  new = re.sub(
    r'name:\s*"(?:掌球教练)"(\s*,\s*\n\s*short:\s*")(?:掌球教练)"',
    r'name: "涨球教练"\1涨球教练"',
    new,
  )
  new = new.replace('short: "Coach Dongdong"', 'short: "Zhangqiu Coach"')
  new = new.replace('short: "东东教练"', 'short: "涨球教练"')
  new = new.replace('short: "掌球教练"', 'short: "涨球教练"')
  new = new.replace('short:"Coach Dongdong"', 'short:"Zhangqiu Coach"')
  new = new.replace('short:"东东教练"', 'short:"涨球教练"')
  new = new.replace('short:"掌球教练"', 'short:"涨球教练"')
  new = new.replace('name:"Poppy",short:"Zhangqiu Coach"', 'name:"Zhangqiu Coach",short:"Zhangqiu Coach"')
  new = new.replace('name:"Poppy",short:"涨球教练"', 'name:"涨球教练",short:"涨球教练"')
  new = new.replace('name:"掌球教练",short:"掌球教练"', 'name:"涨球教练",short:"涨球教练"')
  new = new.replace('name:"掌球教练",short:"涨球教练"', 'name:"涨球教练",short:"涨球教练"')
  # Global leftover display tokens (never invent Palm Ball)
  if "掌球教练" in new:
    new = new.replace("掌球教练", "涨球教练")
  if "Palm Ball Coach" in new:
    new = new.replace("Palm Ball Coach", "Zhangqiu Coach")
  if "Poppy" in new or "东东" in new or "Dongdong" in new:
    new2 = new
    new2 = re.sub(r'(?<![A-Za-z])Poppy(?![A-Za-z])', 'Zhangqiu Coach', new2)
    new2 = new2.replace("东东教练", "涨球教练")
    new2 = new2.replace("Coach Dongdong", "Zhangqiu Coach")
    # Revert accidental id / key path damage
    new2 = new2.replace('id: "Zhangqiu Coach"', 'id: "poppy"')
    new2 = new2.replace("id: 'Zhangqiu Coach'", "id: 'poppy'")
    new2 = new2.replace('DEFAULT_COACH_ID = "Zhangqiu Coach"', 'DEFAULT_COACH_ID = "poppy"')
    new2 = new2.replace('CoachId = "Zhangqiu Coach"', 'CoachId = "poppy"')
    new2 = new2.replace('return value === "Zhangqiu Coach"', 'return value === "poppy"')
    new2 = new2.replace('roster.Zhangqiu Coach.', 'roster.poppy.')
    new2 = new2.replace('roster/Zhangqiu Coach', 'roster/poppy')
    new2 = new2.replace('"Zhangqiu Coach": {', '"poppy": {')
    new2 = re.sub(
      r'(poppy:\s*\{\s*name:\s*")Zhangqiu Coach("\s*,\s*\n\s*short:\s*"涨球教练")',
      r'\1涨球教练\2',
      new2,
    )
    new2 = new2.replace("Zhangqiu Coach教练", "涨球教练")
    new = new2
  return new


def write_if_changed(path: pathlib.Path, new: str, old: str) -> None:
  if new == old:
    return
  backup_file(path)
  path.write_text(new, encoding="utf-8")
  changed.append(str(path))


for path in files:
  try:
    text = path.read_text(encoding="utf-8")
  except Exception:
    continue
  write_if_changed(path, apply_pairs(text), text)

# Patch live APK JS assets if present (Poppy / 东东 still common in older APK)
apk_candidates = [
  pathlib.Path("/var/www/html/tennis-ai.apk"),
  pathlib.Path("/usr/share/nginx/html/tennis-ai.apk"),
  pathlib.Path("/www/wwwroot/yqchen.blog/tennis-ai.apk"),
  root / "public" / "tennis-ai.apk",
  root / "tennis-ai.apk",
]
apk_candidates.extend(pathlib.Path("/var/www").glob("**/tennis-ai.apk") if pathlib.Path("/var/www").is_dir() else [])
apk_candidates.extend(pathlib.Path("/www/wwwroot").glob("**/tennis-ai.apk") if pathlib.Path("/www/wwwroot").is_dir() else [])

apk_patched = []
for apk in apk_candidates:
  if not apk.is_file():
    continue
  try:
    zin = zipfile.ZipFile(apk, "r")
  except Exception:
    continue
  names = [n for n in zin.namelist() if n.endswith((".js", ".json", ".html", ".txt"))]
  updates = {}
  for n in names:
    try:
      raw = zin.read(n)
      text = raw.decode("utf-8")
    except Exception:
      continue
    new = apply_pairs(text)
    if new != text:
      updates[n] = new.encode("utf-8")
  if not updates:
    zin.close()
    continue
  backup_file(apk)
  buf = io.BytesIO()
  with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
      data = updates.get(item.filename, zin.read(item.filename))
      zout.writestr(item, data)
  zin.close()
  apk.write_bytes(buf.getvalue())
  apk_patched.append(f"{apk} ({len(updates)} entries)")

print(f"patched {len(changed)} text files; backup {backup}")
for c in changed[:80]:
  print(" ", c)
if len(changed) > 80:
  print(f"  … +{len(changed)-80} more")
for a in apk_patched:
  print(" apk:", a)

# Verify no banned display strings remain in patched tree (id poppy ok)
remain = []
scan_roots = [root]
for p in list(files)[:]:
  try:
    t = p.read_text(encoding="utf-8")
  except Exception:
    continue
  for ban in banned_after:
    if ban in t:
      remain.append(f"{p}: still has {ban}")
if remain:
  print("WARNING leftover banned display strings:")
  for r in remain[:40]:
    print(" ", r)
  sys.exit(3)
if not changed and not apk_patched:
  print("nothing matched — already corrected or paths differ", file=sys.stderr)
  sys.exit(2)
PY

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

# Reload nginx if get-zhangqiu.html was served statically
if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
  systemctl reload nginx || true
fi

echo "done. Spot-check: /tennis/coach + get-zhangqiu.html — expect 涨球教练 / Zhangqiu Coach; no 掌球教练 / Poppy / 东东 / Palm Ball Coach."
