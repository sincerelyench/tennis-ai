#!/usr/bin/env bash
# Restore 球友 in player bottom nav; keep 选教练 inside Coach tab.
# Run on 8.216.53.29 (or via SSH) as root against /opt/tennis-ai.
# Brand 涨球; default coach display 涨球教练 (not 掌球教练 / Poppy / 东东).
# Does not reintroduce 搜索球友/球场 or NTRP ladder labels.
set -euo pipefail

ROOT="${TENNIS_AI_ROOT:-/opt/tennis-ai}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAP="${SCRIPT_DIR}/chunk-replacements.json"
SECTION_SRC="${SCRIPT_DIR}/opt-patch/components/coach-select-section.tsx"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ROOT}/.restore-friends-tab-backup-${STAMP}"

if [[ ! -d "$ROOT" ]]; then
  echo "tennis-ai root not found: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$MAP" ]]; then
  echo "missing chunk-replacements.json at $MAP" >&2
  exit 1
fi

mkdir -p "$BACKUP"
echo "backup -> $BACKUP"

python3 - "$ROOT" "$MAP" "$BACKUP" "$SECTION_SRC" <<'PY'
import json, re, sys, pathlib, shutil

root = pathlib.Path(sys.argv[1])
pairs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
backup = pathlib.Path(sys.argv[3])
section_src = pathlib.Path(sys.argv[4])
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


# --- 1) AppShell source: coaches nav → friends ---
shell_candidates = [
    root / "components" / "app-shell.tsx",
    root / "apps" / "web" / "components" / "app-shell.tsx",
    root / "src" / "components" / "app-shell.tsx",
]
shell_patterns = [
    # object literals (tsx)
    (
        re.compile(
            r'\{\s*href:\s*["\']/coaches["\']\s*,\s*key:\s*["\']coaches["\']\s*,\s*labelKey:\s*["\']coaches\.nav["\']',
            re.M,
        ),
        '{ href: "/friends", key: "friends", labelKey: "nav.friends"',
    ),
]

for shell in shell_candidates:
    if not shell.is_file():
        continue
    text = shell.read_text(encoding="utf-8")
    new = text
    for pat, repl in shell_patterns:
        new = pat.sub(repl, new)
    # Icon: prefer Users for friends tab
    if 'labelKey: "nav.friends"' in new or "labelKey: 'nav.friends'" in new:
        if "Users" not in new and "from \"lucide-react\"" in new:
            new = new.replace(
                'from "lucide-react"',
                'from "lucide-react"',
            )
            # Add Users to named import if missing
            new = re.sub(
                r'import\s*\{([^}]+)\}\s*from\s*["\']lucide-react["\']',
                lambda m: (
                    m.group(0)
                    if "Users" in m.group(1)
                    else "import {" + m.group(1).rstrip() + ", Users } from \"lucide-react\""
                ),
                new,
                count=1,
            )
        # If friends entry still uses GraduationCap / coaches icon name, swap
        new = re.sub(
            r'(href:\s*["\']/friends["\'][^\}]*icon:\s*)(GraduationCap|k)\b',
            r"\1Users",
            new,
        )
        new = re.sub(
            r'(key:\s*["\']friends["\'][^\}]*icon:\s*)(GraduationCap)\b',
            r"\1Users",
            new,
        )
    # Also handle minified-ish single-line forms via pair map
    new = apply_pairs(new)
    write_if_changed(shell, new, text)


# --- 2) CoachView: embed published PlayerCoachPicker; hide legacy roster chips ---
coach_view_candidates = [
    root / "components" / "coach-view.tsx",
    root / "apps" / "web" / "components" / "coach-view.tsx",
    root / "src" / "components" / "coach-view.tsx",
]

section_body = section_src.read_text(encoding="utf-8") if section_src.is_file() else ""
section_dest = root / "components" / "coach-select-section.tsx"
if section_body and (root / "components").is_dir():
    old = section_dest.read_text(encoding="utf-8") if section_dest.is_file() else ""
    write_if_changed(section_dest, section_body, old)

MARKER_IMPORT = 'import { PlayerCoachPicker } from "@/components/player-coach-picker";'
MARKER_SECTION = 'import { CoachSelectSection } from "@/components/coach-select-section";'
INJECT_JSX = (
    '<CoachSelectSection locale={locale === "zh" || locale?.startsWith?.("zh") ? "zh" : "en"} '
    "onSelect={(id) => { try { writeCoachId?.(id); } catch (_) {} "
    "try { typeof setCoachId === \"function\" && setCoachId(id); } catch (_) {} }} />"
)

for cv in coach_view_candidates:
    if not cv.is_file():
        continue
    text = cv.read_text(encoding="utf-8")
    new = text
    if "PlayerCoachPicker" not in new and "CoachSelectSection" not in new:
        # Prefer CoachSelectSection wrapper
        if MARKER_SECTION not in new:
            # Insert after first import block
            m = re.search(r"(import .+?;\n)(?!import )", new, re.S)
            if m:
                new = new[: m.end()] + MARKER_SECTION + "\n" + new[m.end() :]
            else:
                new = MARKER_SECTION + "\n" + new
        # Inject after title / near top return — look for coach.pickTitle block or h1 coach.title
        if "CoachSelectSection" not in new.split("return", 1)[-1]:
            # Hide legacy data-coach-select roster by wrapping comment if present
            new2 = re.sub(
                r"(<h1[^>]*>\{[^}]*coach\.title[^}]*\}</h1>)",
                r"\1\n      " + INJECT_JSX + "\n",
                new,
                count=1,
            )
            if new2 == new:
                # Fallback: inject before first <section
                new2 = re.sub(
                    r"(return\s*\([^)]*?<\w+[^>]*>)",
                    r"\1\n      " + INJECT_JSX + "\n",
                    new,
                    count=1,
                    flags=re.S,
                )
            new = new2
        # Hide legacy roster select if still present (keep DOM out of sight)
        new = new.replace('data-coach-select="true"', 'data-coach-select="legacy" hidden')
        new = re.sub(
            r'data-coach-select=\{?"true"?\}?',
            'data-coach-select="legacy" hidden',
            new,
        )
    write_if_changed(cv, new, text)


# --- 3) Chunk / messages hotpatch (pre-rebuild safety) ---
scan_roots = [
    root / ".next" / "static" / "chunks",
    root / "apps" / "web" / ".next" / "static" / "chunks",
]
for scan in scan_roots:
    if not scan.is_dir():
        continue
    for path in scan.rglob("*.js"):
        if any(part.startswith(".") and part != ".next" for part in path.parts):
            pass
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        if "/coaches" not in text and "coaches.nav" not in text:
            continue
        # Only touch AppShell-like player nav arrays
        if "nav.analyze" not in text and "labelKey:\"nav.analyze\"" not in text and "labelKey:\"nav.coach\"" not in text:
            if "nav.coach" not in text and 'labelKey:"nav.me"' not in text:
                continue
        new = apply_pairs(text)
        write_if_changed(path, new, text)

# i18n: ensure nav.friends exists; do not put 选教练 in bottom bar copy accidentally
for msg in root.rglob("messages.ts"):
    if "node_modules" in msg.parts or ".restore-friends" in str(msg):
        continue
    text = msg.read_text(encoding="utf-8")
    new = text
    if "friends:" not in text and "nav:" in text:
        new = re.sub(
            r"(nav:\s*\{[^\}]*coach:\s*[^,\n]+,)",
            r'\1\n    friends: "球友",',
            new,
            count=1,
        )
    # Soft-fix display name if still 掌球教练 in coach publish keys
    new = new.replace("掌球教练", "涨球教练")
    write_if_changed(msg, new, text)

print("changed files:")
for c in changed:
    print(" -", c)
if not changed:
    print(" (no textual diffs — sources may already be correct; still rebuild recommended)")
PY

echo
echo "==> installing coach-select-section if components/ exists"
if [[ -d "$ROOT/components" && -f "$SECTION_SRC" ]]; then
  cp -v "$SECTION_SRC" "$ROOT/components/coach-select-section.tsx" || true
fi

echo
echo "==> build + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v npm >/dev/null 2>&1; then
    npm run build
  fi
fi
if systemctl list-unit-files 2>/dev/null | grep -q '^tennis-ai'; then
  systemctl restart tennis-ai
  systemctl --no-pager --full status tennis-ai | head -20 || true
fi

echo
echo "done. Spot-check:"
echo "  bottom nav: 分析 | 教练 | 球友 | 我的  (no 选教练 in bar)"
echo "  /tennis/friends — UTR ladder + list, no search"
echo "  /tennis/coach — 选教练 / 涨球教练 inside page"
echo "  backup: $BACKUP"
