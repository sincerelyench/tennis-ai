#!/usr/bin/env bash
# Friends ladder: keep UTR-like rating math; drop NTRP labels on the ladder UI.
# Run on 8.216.53.29 (or via SSH) as root. Does not touch 搜索球友/球场 removal.
# Product brand 涨球 / coach 掌球教练 unchanged.
set -euo pipefail

ROOT="${TENNIS_AI_ROOT:-/opt/tennis-ai}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAP="${SCRIPT_DIR}/i18n-replacements.json"
LADDER_SRC="${SCRIPT_DIR}/local-ladder.ts"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.friends-utr-backup-${STAMP}"

if [[ ! -f "$MAP" ]]; then
  echo "missing i18n-replacements.json at $MAP" >&2
  exit 1
fi
if [[ ! -d "$ROOT" ]]; then
  echo "tennis-ai root not found: $ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP"

python3 - "$ROOT" "$MAP" "$BACKUP" "$LADDER_SRC" <<'PY'
import json, re, sys, pathlib, shutil

root = pathlib.Path(sys.argv[1])
pairs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
backup = pathlib.Path(sys.argv[3])
ladder_src = pathlib.Path(sys.argv[4])

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


def apply_pairs(text: str) -> str:
    new = text
    for old, repl in pairs:
        new = new.replace(old, repl)
    return new


# --- 1) Install / refresh documented UTR-like ladder module ---
ladder_body = ladder_src.read_text(encoding="utf-8")
ladder_dests: list[pathlib.Path] = []
# Prefer overwriting an existing local-ladder.ts anywhere under the tree
for p in root.rglob("local-ladder.ts"):
    if ".friends-utr-backup" in str(p) or "node_modules" in p.parts:
        continue
    ladder_dests.append(p)
# If none exist yet, drop into known app layouts when those dirs are present
if not ladder_dests:
    for dest in [
        root / "lib" / "local-ladder.ts",
        root / "apps" / "web" / "lib" / "local-ladder.ts",
        root / "apps" / "uniapp" / "src" / "local-ladder.ts",
    ]:
        if dest.parent.is_dir() or (dest.parent.parent.is_dir() and dest.parent.name == "lib"):
            ladder_dests.append(dest)
for dest in ladder_dests:
    dest.parent.mkdir(parents=True, exist_ok=True)
    old = dest.read_text(encoding="utf-8") if dest.is_file() else ""
    if old == ladder_body:
        continue
    if dest.is_file():
        backup_file(dest)
    dest.write_text(ladder_body, encoding="utf-8")
    changed.append(str(dest.relative_to(root)) + (" (updated)" if old else " (written)"))


# --- 2) Source: friends-view — NTRP label → UTR seed; seedOnly uses rating seed ---
for cand in [
    root / "components" / "friends-view.tsx",
    root / "apps" / "web" / "components" / "friends-view.tsx",
    root / "src" / "components" / "friends-view.tsx",
]:
    if not cand.is_file():
        continue
    text = cand.read_text(encoding="utf-8")
    new = text
    # List row subtitle: NTRP {ntrp} → UTR {seed}
    new = re.sub(
        r'(["\'])NTRP\1\s*\+\s*[`"\']?\s*\{?[^}]*ntrp[^}]*\}?',
        lambda m: m.group(0),  # fallback no-op; concrete replaces below
        new,
        count=0,
    )
    new = new.replace("`NTRP ${", "`UTR ${")
    new = new.replace('"NTRP "', '"UTR "')
    new = new.replace("'NTRP '", "'UTR '")
    new = new.replace(">NTRP {", ">UTR {")
    # Prefer showing UTR seed (selfLevel × 2.15) instead of raw self-level
    new = re.sub(
        r'\["NTRP ",\s*(\w+)\.ntrp,\s*" · ",',
        r'["UTR ", (Math.round(10 * 2.15 * \1.ntrp) / 10).toFixed(1), " · ",',
        new,
    )
    new = re.sub(
        r"seedOnly\",\s*\{\s*n:\s*(\w+)\.ntrp\.toFixed\(1\)\s*\}",
        r'seedOnly", { n: \1.seed.toFixed(1) }',
        new,
    )
    new = re.sub(
        r"seedOnly',\s*\{\s*n:\s*(\w+)\.ntrp\.toFixed\(1\)\s*\}",
        r"seedOnly', { n: \1.seed.toFixed(1) }",
        new,
    )
    new = apply_pairs(new)
    write_if_changed(cand, new, text)


# --- 3) uni-app friends page ---
for cand in [
    root / "apps" / "uniapp" / "src" / "pages" / "friends" / "index.vue",
    root / "apps" / "uniapp" / "pages" / "friends" / "index.vue",
]:
    if not cand.is_file():
        continue
    text = cand.read_text(encoding="utf-8")
    new = text
    new = new.replace("NTRP {{", "UTR {{")
    new = new.replace("NTRP ${", "UTR ${")
    new = new.replace(">NTRP ", ">UTR ")
    new = re.sub(
        r"(seedOnly[^\n]{0,80})ntrp\.toFixed\(1\)",
        r"\1seed.toFixed(1)",
        new,
    )
    # Template like: NTRP {{ friend.ntrp }}
    new = re.sub(
        r"NTRP\s*\{\{\s*([\w.]+)\.ntrp\s*\}\}",
        r"UTR {{ (Math.round(10 * 2.15 * \1.ntrp) / 10).toFixed(1) }}",
        new,
    )
    new = apply_pairs(new)
    write_if_changed(cand, new, text)


# --- 4) i18n message sources + built chunks ---
globs = [
    "**/messages/**/*.{json,ts,tsx,js}",
    "**/locales/**/*.{json,ts,tsx,js}",
    "**/i18n/**/*.{json,ts,tsx,js,vue}",
    "**/*friends*.{ts,tsx,js,vue,json}",
    "**/*ladder*.{ts,tsx,js}",
    "**/.next/static/chunks/*.js",
    "**/apps/web/.next/static/chunks/*.js",
]
patterns: list[str] = []
for g in globs:
    if "{json,ts,tsx,js}" in g:
        for ext in ("json", "ts", "tsx", "js"):
            patterns.append(g.replace("{json,ts,tsx,js}", ext))
    elif "{json,ts,tsx,js,vue}" in g:
        for ext in ("json", "ts", "tsx", "js", "vue"):
            patterns.append(g.replace("{json,ts,tsx,js,vue}", ext))
    elif "{ts,tsx,js,vue,json}" in g:
        for ext in ("ts", "tsx", "js", "vue", "json"):
            patterns.append(g.replace("{ts,tsx,js,vue,json}", ext))
    elif "{ts,tsx,js}" in g:
        for ext in ("ts", "tsx", "js"):
            patterns.append(g.replace("{ts,tsx,js}", ext))
    else:
        patterns.append(g)

seen: set[pathlib.Path] = set()
files: list[pathlib.Path] = []
for pat in patterns:
    for p in root.glob(pat):
        if p.is_file() and p not in seen:
            seen.add(p)
            files.append(p)

for path in files:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    new = apply_pairs(text)
    # Minified friends list row: ["NTRP ",s.ntrp," · ",
    new = new.replace('["NTRP ",s.ntrp," · ",', '["UTR ",(Math.round(21.5*s.ntrp)/10).toFixed(1)," · ",')
    new = new.replace("['NTRP ',s.ntrp,' · ',", "['UTR ',(Math.round(21.5*s.ntrp)/10).toFixed(1),' · ',")
    # Ladder seedOnly still passed raw ntrp — use UTR seed field
    new = new.replace(
        'friends.seedOnly",{n:e.ntrp.toFixed(1)}',
        'friends.seedOnly",{n:e.seed.toFixed(1)}',
    )
    new = new.replace(
        "friends.seedOnly',{n:e.ntrp.toFixed(1)}",
        "friends.seedOnly',{n:e.seed.toFixed(1)}",
    )
    new = new.replace(
        'friends.seedOnly",{n:t.ntrp.toFixed(1)}',
        'friends.seedOnly",{n:t.seed.toFixed(1)}',
    )
    if new == text:
        continue
    # Only keep patches that actually remove NTRP from friends ladder copy
    # or rewrite the list/ladder display hooks above.
    write_if_changed(path, new, text)

print(f"patched {len(changed)} files; backup {backup}")
for c in changed[:60]:
    print(" ", c)
if len(changed) > 60:
    print(f"  … +{len(changed)-60} more")
if not changed:
    print("WARNING: no files changed — tree layout may differ; inspect local-ladder / friends i18n", file=sys.stderr)
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

echo "done. Spot-check /tennis/friends — expect UTR ratings on ladder, no NTRP labels on ranking UI."
