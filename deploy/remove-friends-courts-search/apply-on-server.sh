#!/usr/bin/env bash
# Remove 搜索球友 / 搜索球场 from 涨球 Friends tab on the production Next host.
# Run on 8.216.53.29 (or via SSH) as root. Does not rename 掌球教练 / 涨球.
set -euo pipefail

ROOT="${TENNIS_AI_ROOT:-/opt/tennis-ai}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAP="${SCRIPT_DIR}/chunk-replacements.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.remove-friends-search-backup-${STAMP}"

if [[ ! -f "$MAP" ]]; then
  echo "missing chunk-replacements.json at $MAP" >&2
  exit 1
fi
if [[ ! -d "$ROOT" ]]; then
  echo "tennis-ai root not found: $ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP"

python3 - "$ROOT" "$MAP" "$BACKUP" "$SCRIPT_DIR" <<'PY'
import json, re, sys, pathlib, shutil

root = pathlib.Path(sys.argv[1])
pairs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
backup = pathlib.Path(sys.argv[3])
script_dir = pathlib.Path(sys.argv[4])

changed: list[str] = []


def backup_file(path: pathlib.Path) -> None:
    rel = path.relative_to(root)
    dest = backup / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        shutil.copy2(path, dest)


def write_if_changed(path: pathlib.Path, new: str, old: str) -> None:
    if new == old:
        return
    backup_file(path)
    path.write_text(new, encoding="utf-8")
    changed.append(str(path.relative_to(root)))


# --- 1) Source: friends-view.tsx ---
for cand in [
    root / "components" / "friends-view.tsx",
    root / "apps" / "web" / "components" / "friends-view.tsx",
    root / "src" / "components" / "friends-view.tsx",
]:
    if not cand.is_file():
        continue
    text = cand.read_text(encoding="utf-8")
    new = text
    # Remove Input that binds friends.searchPh / searchAria (self-closing or paired)
    new = re.sub(
        r"<Input\b[^>]*?(?:placeholder=\{[^}]*searchPh[^}]*\}|aria-label=\{[^}]*searchAria[^}]*\})[^>]*/>\s*",
        "",
        new,
        flags=re.S,
    )
    new = re.sub(
        r"<Input\b[^>]*?(?:placeholder=\{[^}]*searchPh[^}]*\}|aria-label=\{[^}]*searchAria[^}]*\})[^>]*>\s*</Input>\s*",
        "",
        new,
        flags=re.S,
    )
    # Filter useMemo driven by search query → use full friends list
    new = re.sub(
        r"const\s+(\w+)\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\.trim\(\)[\s\S]*?friends\.filter[\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\)",
        r"const \1 = friends",
        new,
        count=1,
    )
    # Unused search useState("") is harmless once Input/filter are gone.
    # Message string updates in colocated files are handled below
    write_if_changed(cand, new, text)

# --- 2) uni-app friends page ---
for cand in [
    root / "apps" / "uniapp" / "src" / "pages" / "friends" / "index.vue",
    root / "apps" / "uniapp" / "pages" / "friends" / "index.vue",
]:
    if not cand.is_file():
        continue
    text = cand.read_text(encoding="utf-8")
    new = text
    # Remove search input blocks with known placeholders
    new = re.sub(
        r"<input[^>]*(?:Search friends or courts|搜索球友或球场|searchPh)[^>]*/?>\s*",
        "",
        new,
        flags=re.I,
    )
    new = re.sub(
        r"<uni-search-bar[\s\S]*?</uni-search-bar>\s*",
        "",
        new,
        flags=re.I,
    )
    new = re.sub(
        r"<view[^>]*class=\"[^\"]*search[^\"]*\"[\s\S]*?</view>\s*",
        lambda m: "" if re.search(r"search|placeholder|v-model", m.group(0), re.I) else m.group(0),
        new,
        count=1,
    )
    # Hardcoded EN placeholders
    for old, repl in [
        ("Search friends or courts", ""),
        ("搜索球友或球场", ""),
        ("搜索球友、城区或打法", ""),
        ("搜索球友或无锡球场", ""),
    ]:
        new = new.replace(old, repl)
    write_if_changed(cand, new, text)

# --- 3) i18n messages (ts/json) ---
msg_globs = [
    "**/messages.ts",
    "**/messages/*.ts",
    "**/i18n/**/*.ts",
    "**/locales/**/*.{json,ts}",
]
msg_files: list[pathlib.Path] = []
seen = set()
for g in [
    "**/messages.ts",
    "**/lib/i18n/messages.ts",
    "**/i18n/messages.ts",
    "**/messages.json",
]:
    for p in root.glob(g):
        if p.is_file() and p not in seen:
            seen.add(p)
            msg_files.append(p)

msg_pairs = [
    ('searchPh: "Search friends or courts"', 'searchPh: ""'),
    ("searchPh: 'Search friends or courts'", "searchPh: ''"),
    ('searchPh: "搜索球友或球场"', 'searchPh: ""'),
    ("searchPh: '搜索球友或球场'", "searchPh: ''"),
    ('searchAria: "Search friends"', 'searchAria: ""'),
    ('searchAria: "搜索球友"', 'searchAria: ""'),
    ('emptyDesc: "Try another name or court."', 'emptyDesc: "No friends listed yet."'),
    ('emptyDesc: "换个名字或场地再试。"', 'emptyDesc: "这一带暂时没有球友。"'),
    ('empty: "No friends found"', 'empty: "No friends yet"'),
    ('empty: "没有找到球友"', 'empty: "还没有球友"'),
    # JSON-style
    ('"searchPh": "Search friends or courts"', '"searchPh": ""'),
    ('"searchPh": "搜索球友或球场"', '"searchPh": ""'),
    ('"searchAria": "Search friends"', '"searchAria": ""'),
    ('"searchAria": "搜索球友"', '"searchAria": ""'),
    ('"emptyDesc": "Try another name or court."', '"emptyDesc": "No friends listed yet."'),
    ('"emptyDesc": "换个名字或场地再试。"', '"emptyDesc": "这一带暂时没有球友。"'),
]

for path in msg_files:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if "searchPh" not in text and "搜索球友" not in text and "Try another name or court" not in text:
        continue
    new = text
    for old, repl in msg_pairs:
        new = new.replace(old, repl)
    # also apply minified message forms
    for old, repl in pairs:
        if "searchPh" in old or "emptyDesc" in old or "empty:" in old or "searchAria" in old:
            new = new.replace(old, repl)
    write_if_changed(path, new, text)

# --- 4) Built Next chunks ---
chunk_dirs = [
    root / ".next" / "static" / "chunks",
    root / "apps" / "web" / ".next" / "static" / "chunks",
]
chunk_files: list[pathlib.Path] = []
for d in chunk_dirs:
    if d.is_dir():
        chunk_files.extend(sorted(d.glob("*.js")))

for path in chunk_files:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if not any(old in text for old, _ in pairs):
        # also catch search Input pattern alone
        if "friends.searchPh" not in text and "搜索球友或球场" not in text:
            continue
    new = text
    for old, repl in pairs:
        new = new.replace(old, repl)
    # Extra: strip Input jsx if attribute order differs slightly
    new = re.sub(
        r",?\(0,t\.jsx\)\(O\.Input,\{value:[^,]+,onChange:[^,]+,placeholder:e\([\"']friends\.searchPh[\"']\),[\"']aria-label[\"']:e\([\"']friends\.searchAria[\"']\),className:[\"']h-10 bg-background[\"']\}\)",
        "",
        new,
    )
    write_if_changed(path, new, text)

print(f"patched {len(changed)} files; backup {backup}")
for c in changed[:80]:
    print(" ", c)
if len(changed) > 80:
    print(f"  … +{len(changed) - 80} more")
if not changed:
    print("WARNING: no files changed — tree layout may differ; inspect friends-view / chunks", file=sys.stderr)
    sys.exit(2)

# Copy checklist notes into backup for operators
notes = script_dir / "opt-patch"
if notes.is_dir():
    dest = backup / "_opt-patch-notes"
    shutil.copytree(notes, dest, dirs_exist_ok=True)
PY

# Rebuild when full source tree exists
if [[ -f "$ROOT/package.json" ]] && grep -q '"build"' "$ROOT/package.json"; then
  if id tennis >/dev/null 2>&1; then
    echo "rebuilding as tennis…"
    su -s /bin/bash tennis -c "cd '$ROOT' && npm run build" || {
      echo "rebuild failed — chunk patches (if any) still applied" >&2
    }
  else
    echo "user tennis missing; skip rebuild (chunks already patched)"
  fi
fi

if systemctl list-unit-files tennis-ai.service >/dev/null 2>&1; then
  systemctl restart tennis-ai
  systemctl --no-pager --full status tennis-ai | head -20
fi

echo "done. Spot-check /tennis/friends — expect ladder + list, no 搜索球友/搜索球场 search box."
