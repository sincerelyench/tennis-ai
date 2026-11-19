#!/usr/bin/env python3
"""Build deploy/zhangqiule-rename from /tmp/zq155-prod-pull (ZQ-155)."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

KIT = Path(__file__).resolve().parents[1] / "deploy" / "zhangqiule-rename"
SRC = Path("/tmp/zq155-prod-pull/src")
GET = Path("/tmp/zq155-prod-pull/get-zhangqiu.html")


def transform(text: str) -> str:
    text = text.replace("涨球乐", "\0ZQLE\0")
    text = text.replace("涨球测试", "\0ZQTEST\0")
    text = text.replace("|涨球教练|", "|\0OLDCOACH\0|")
    text = text.replace(
        "/Poppy|东东|Dongdong|涨球教练/gi",
        "/Poppy|东东|Dongdong|\0OLDCOACH\0/gi",
    )
    text = text.replace("涨球教练", "AI 教练")
    text = text.replace("涨球", "涨球乐")
    text = text.replace("\0OLDCOACH\0", "涨球教练")
    text = text.replace("\0ZQTEST\0", "涨球测试")
    text = text.replace("\0ZQLE\0", "涨球乐")
    text = text.replace(
        "掌球教练|Palm Ball Coach|AI 教练|Zhangqiu Coach",
        "掌球教练|Palm Ball Coach|涨球教练|涨球乐教练|Zhangqiu Coach",
    )
    text = text.replace(
        'DEFAULT_COACH_DISPLAY_ZH = "涨球乐教练"',
        'DEFAULT_COACH_DISPLAY_ZH = "AI 教练"',
    )
    text = text.replace(
        'DEFAULT_COACH_DISPLAY_EN = "Zhangqiu Coach"',
        'DEFAULT_COACH_DISPLAY_EN = "AI Coach"',
    )
    return text


def main() -> None:
    assert SRC.exists(), SRC
    assert GET.exists(), GET
    if KIT.exists():
        shutil.rmtree(KIT)
    opt = KIT / "opt-patch"
    www = KIT / "www-apk"
    scripts = KIT / "scripts"
    opt.mkdir(parents=True)
    www.mkdir(parents=True)
    scripts.mkdir(parents=True)

    n = 0
    for path in SRC.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(SRC)
        dest = opt / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(transform(path.read_text(encoding="utf-8")), encoding="utf-8")
        n += 1
    print("copied", n)

    www.joinpath("get-zhangqiu.html").write_text(
        transform(GET.read_text(encoding="utf-8")), encoding="utf-8"
    )

    print("=== remaining bare 涨球 (not 乐/测试/教练-in-ban) ===")
    for path in list(opt.rglob("*")) + [www / "get-zhangqiu.html"]:
        if not path.is_file():
            continue
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"涨球(?!乐|测试)", line) and "涨球教练" not in line:
                print(f"{path.relative_to(KIT)}:{i}:{line.strip()[:140]}")

    scripts.joinpath("apply-on-server.sh").write_text(
        """#!/usr/bin/env bash
# ZQ-155: Rename product brand 涨球 → 涨球乐 (four-surface). AI coach stays 「AI 教练」.
set -euo pipefail
ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.zhangqiule-rename-backup-$STAMP"
echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"
while IFS= read -r -d '' f; do
  rel="${f#"$PATCH_DIR/opt-patch/"}"
  src="$ROOT/$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$src" "$BACKUP/$rel"
  fi
done < <(find "$PATCH_DIR/opt-patch" -type f -print0)
echo "==> Install opt-patch"
cp -a "$PATCH_DIR/opt-patch/." "$ROOT/"
if [[ -f "$PATCH_DIR/www-apk/get-zhangqiu.html" ]]; then
  mkdir -p /var/www/apk
  [[ -f /var/www/apk/get-zhangqiu.html ]] && cp -a /var/www/apk/get-zhangqiu.html "$BACKUP/get-zhangqiu.html" || true
  cp -a "$PATCH_DIR/www-apk/get-zhangqiu.html" /var/www/apk/get-zhangqiu.html
  chmod 644 /var/www/apk/get-zhangqiu.html || true
fi
mkdir -p /var/www/apk
cat > /var/www/apk/ZHANGQIULE-RENAME-NOTE.txt <<'NOTE'
涨球乐 rename (ZQ-155)
- Product brand 涨球 → 涨球乐 across /tennis i18n, onboarding, get-zhangqiu, share metadata.
- AI coach display remains 「AI 教练」.
NOTE
chmod 644 /var/www/apk/ZHANGQIULE-RENAME-NOTE.txt || true
echo "==> Sanity"
grep -n 'brand: "涨球乐"' "$ROOT/lib/i18n/messages.ts" | head -5
grep -n '欢迎来到涨球乐' "$ROOT/lib/i18n/messages.ts" | head -3
grep -n 'default: "涨球乐"' "$ROOT/app/layout.tsx" | head -3
! grep -n 'brand: "涨球"' "$ROOT/lib/i18n/messages.ts"
cd "$ROOT"
if [[ -f package.json ]]; then
  if command -v pnpm >/dev/null 2>&1; then pnpm build || npx next build --webpack || npm run build
  else npx next build --webpack || npm run build; fi
fi
systemctl restart tennis-ai
sleep 3
systemctl is-active tennis-ai
echo DONE
""",
        encoding="utf-8",
    )
    scripts.joinpath("apply-on-server.sh").chmod(0o755)
    KIT.joinpath("README.md").write_text(
        """# ZQ-155 · 涨球 → 涨球乐（四端）

Product brand rename. AI coach stays **AI 教练**.

## Mac apply (after PR)

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e ssh root@8.216.53.29 'rm -rf /tmp/zhangqiule-rename'
sshpass -e scp -r deploy/zhangqiule-rename root@8.216.53.29:/tmp/zhangqiule-rename
sshpass -e ssh root@8.216.53.29 'bash /tmp/zhangqiule-rename/scripts/apply-on-server.sh /opt/tennis-ai'
```
""",
        encoding="utf-8",
    )
    print("kit files", sum(1 for _ in KIT.rglob("*") if _.is_file()))


if __name__ == "__main__":
    main()
