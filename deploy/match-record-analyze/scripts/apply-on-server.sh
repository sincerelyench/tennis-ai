#!/usr/bin/env bash
# Apply 涨球 match record + analyze MVP onto /opt/tennis-ai (Next web).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.match-record-analyze-backup-$STAMP"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib" "$BACKUP/app/analysis" "$BACKUP/app/share" "$BACKUP/app/api" "$BACKUP/public"
cp -a "$ROOT/components/reports-view.tsx" "$BACKUP/components/" 2>/dev/null || true
cp -a "$ROOT/middleware.ts" "$BACKUP/" 2>/dev/null || true

echo "==> Install lib + components"
cp -a "$PATCH_DIR/web-patch/lib/match-demo.ts" "$ROOT/lib/match-demo.ts"
cp -a "$PATCH_DIR/web-patch/lib/match-store.ts" "$ROOT/lib/match-store.ts"
cp -a "$PATCH_DIR/web-patch/lib/match-share-store.ts" "$ROOT/lib/match-share-store.ts"
cp -a "$PATCH_DIR/web-patch/lib/camera-setup.ts" "$ROOT/lib/camera-setup.ts"
cp -a "$PATCH_DIR/web-patch/components/match-record-view.tsx" "$ROOT/components/match-record-view.tsx"
cp -a "$PATCH_DIR/web-patch/components/match-detail-view.tsx" "$ROOT/components/match-detail-view.tsx"
cp -a "$PATCH_DIR/web-patch/components/match-share-view.tsx" "$ROOT/components/match-share-view.tsx"
cp -a "$PATCH_DIR/web-patch/components/reports-view.tsx" "$ROOT/components/reports-view.tsx"

echo "==> Install routes"
mkdir -p "$ROOT/app/(main)/analysis/match/[id]"
mkdir -p "$ROOT/app/share/m/[id]"
mkdir -p "$ROOT/app/api/match/share"
cp -a "$PATCH_DIR/web-patch/app/analysis/match/page.tsx" "$ROOT/app/(main)/analysis/match/page.tsx"
cp -a "$PATCH_DIR/web-patch/app/analysis/match/[id]/page.tsx" "$ROOT/app/(main)/analysis/match/[id]/page.tsx"
cp -a "$PATCH_DIR/web-patch/app/share/m/[id]/page.tsx" "$ROOT/app/share/m/[id]/page.tsx"
cp -a "$PATCH_DIR/web-patch/app/api/match/share/route.ts" "$ROOT/app/api/match/share/route.ts"

if [[ -f "$PATCH_DIR/preview/match-record-analyze.html" ]]; then
  cp -a "$PATCH_DIR/preview/match-record-analyze.html" "$ROOT/public/match-record-analyze.html"
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/preview/match-record-analyze.html" /var/www/apk/match-record-analyze.html 2>/dev/null || true
fi

echo "==> Public preview HTML + keep /share/* viewers open (already covers /share/m)"
python3 - <<PY
from pathlib import Path
p = Path("$ROOT/middleware.ts")
text = p.read_text()
changed = False
if "/match-record-analyze.html" not in text:
    needle = '"/remove-analyze-preview.html",'
    insert = '"/remove-analyze-preview.html", "/match-record-analyze.html",'
    if needle in text:
        text = text.replace(needle, insert, 1)
        changed = True
    else:
        needle2 = '"/favicon.ico",'
        if needle2 in text:
            text = text.replace(needle2, needle2 + '\n  "/match-record-analyze.html",', 1)
            changed = True
# POST create share can stay auth-gated; viewers use /share which is public.
if changed:
    p.write_text(text)
    print("middleware: added match-record-analyze.html")
else:
    print("middleware: preview already public or /share covers viewers")
PY

echo "==> Soft-patch i18n analysis.lead to mention match record"
python3 - <<PY
from pathlib import Path
root = Path("$ROOT")
for rel in ("lib/i18n/messages.ts", "lib/messages.ts"):
    p = root / rel
    if not p.exists():
        continue
    text = p.read_text()
    en_old = 'lead: "Review history reports first. To submit another clip, tap New video analysis."'
    en_new = 'lead: "Review history reports, start stroke analyze, or open Match record / analyze."'
    zh_old = 'lead: "先看历史报告。要再传一条视频，点新的视频分析。"'
    zh_new = 'lead: "先看历史报告。可做挥拍技术分析，或打开比赛录制 / 分析。"'
    if en_old in text:
        text = text.replace(en_old, en_new)
    if zh_old in text:
        text = text.replace(zh_old, zh_new)
    if "matchRecord:" not in text:
        text = text.replace(
            'new: "New video analysis",',
            'new: "New video analysis",\n      matchRecord: "Match record / analyze",',
        )
        text = text.replace(
            'new: "新的视频分析",',
            'new: "新的视频分析",\n      matchRecord: "比赛录制 / 分析",',
        )
    p.write_text(text)
    print(f"i18n patched {rel}")
PY

echo "==> Build Next as user tennis"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  su -s /bin/bash tennis -c "cd '$ROOT' && npm run build"
else
  npm run build
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai
systemctl is-active tennis-ai
echo "==> Done match-record-analyze $STAMP"
