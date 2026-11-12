#!/usr/bin/env bash
# Apply: 对话指导 freeform 接真 LLM；修 ha2 豆包模型（用 DOUBAO_LLM_MODEL / pro，不用已关闭的 lite）
# Does NOT touch lib/feature-flags.ts (analysis tab stays hidden).
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
HA2_ROOT="${HA2_ROOT:-/opt/harmonix-ha2}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.coach-dialog-real-ai-backup-$STAMP"
HA2_BACKUP="$HA2_ROOT/.coach-dialog-real-ai-backup-$STAMP"

echo "==> Backup tennis-ai -> $BACKUP"
mkdir -p "$BACKUP"

for f in \
  components/coach-view.tsx \
  components/coach-picker.tsx \
  components/coach-tip-video.tsx \
  lib/coach.ts \
  lib/harmonix.ts \
  app/api/coach/chat/route.ts
do
  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
  fi
done

echo "==> Install tennis-ai opt-patch"
mkdir -p \
  "$ROOT/lib" \
  "$ROOT/components" \
  "$ROOT/public" \
  "$ROOT/app/api/coach/chat"

cp -a "$PATCH_DIR/opt-patch/components/coach-view.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-picker.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/components/coach-tip-video.tsx" "$ROOT/components/"
cp -a "$PATCH_DIR/opt-patch/lib/coach.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/lib/harmonix.ts" "$ROOT/lib/"
cp -a "$PATCH_DIR/opt-patch/app/api/coach/chat/route.ts" "$ROOT/app/api/coach/chat/"

if [[ -f "$PATCH_DIR/preview/index.html" ]]; then
  mkdir -p "$ROOT/public" /var/www/apk
  cp -a "$PATCH_DIR/preview/index.html" "$ROOT/public/coach-dialog-real-ai.html"
  cp -a "$PATCH_DIR/preview/index.html" /var/www/apk/coach-dialog-real-ai.html 2>/dev/null || true
fi

if [[ -f "$PATCH_DIR/mp-patch/COACH-DIALOG-REAL-AI-NOTE.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-DIALOG-REAL-AI-NOTE.txt" /var/www/apk/ 2>/dev/null || true
fi
if [[ -f "$PATCH_DIR/mp-patch/COACH-DIALOG-REAL-AI-SYNC.txt" ]]; then
  mkdir -p /var/www/apk
  cp -a "$PATCH_DIR/mp-patch/COACH-DIALOG-REAL-AI-SYNC.txt" /var/www/apk/ 2>/dev/null || true
fi

# --- ha2: switch closed lite model → DOUBAO_LLM_MODEL / pro ---
if [[ -d "$HA2_ROOT" && -f "$PATCH_DIR/ha2-patch/src/app/api/llm/chat/route.ts" ]]; then
  echo "==> Backup ha2 -> $HA2_BACKUP"
  mkdir -p "$HA2_BACKUP/src/app/api/llm/chat"
  if [[ -f "$HA2_ROOT/src/app/api/llm/chat/route.ts" ]]; then
    cp -a "$HA2_ROOT/src/app/api/llm/chat/route.ts" "$HA2_BACKUP/src/app/api/llm/chat/"
  fi
  echo "==> Patch ha2 llm chat route (use DOUBAO_LLM_MODEL)"
  mkdir -p "$HA2_ROOT/src/app/api/llm/chat"
  cp -a "$PATCH_DIR/ha2-patch/src/app/api/llm/chat/route.ts" "$HA2_ROOT/src/app/api/llm/chat/"
  # Service runs as user ha2 (see harmonix-ha2.service)
  if id ha2 >/dev/null 2>&1; then
    chown ha2:ha2 "$HA2_ROOT/src/app/api/llm/chat/route.ts" 2>/dev/null || true
  fi
  echo "==> Build / restart ha2 (as user ha2)"
  (
    cd "$HA2_ROOT"
    if id ha2 >/dev/null 2>&1; then
      if [[ -x ./scripts/build.sh ]]; then
        sudo -u ha2 bash ./scripts/build.sh
      else
        sudo -u ha2 pnpm build 2>/dev/null || sudo -u ha2 npm run build
      fi
    else
      bash ./scripts/build.sh 2>/dev/null || pnpm build 2>/dev/null || npm run build
    fi
  )
  systemctl restart harmonix-ha2
  sleep 3
  systemctl is-active harmonix-ha2 || true
  # Smoke ha2 locally — must stream content, not ClosedEndpoint
  curl -sf -m 45 -X POST http://127.0.0.1:15000/ha2/api/llm/chat \
    -H 'Content-Type: application/json' \
    -d '{"system":"Reply JSON {\"text\":\"pong\",\"dailyPlan\":null,\"improvePlan\":null,\"tasks\":[],\"drill\":null,\"suggestVideoSkill\":\"fh-topspin\"} only.","messages":[{"role":"user","content":"ping"}]}' \
    | head -c 200 || true
  echo
fi

if [[ -f /etc/nginx/conf.d/ipitch.conf ]] && ! grep -q 'coach-dialog-real-ai.html' /etc/nginx/conf.d/ipitch.conf; then
  python3 - <<'PY' || true
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
text = p.read_text()
if "coach-dialog-real-ai.html" in text:
    raise SystemExit(0)
for marker in (
    "location = /coach-tip-bili-only.html",
    "location = /coach-tip-videos-real.html",
    "location = /embed-coach-tip-videos.html",
):
    idx = text.find(marker)
    if idx >= 0:
        break
else:
    raise SystemExit(0)
end = text.find("}", idx)
end = text.find("\n", end) + 1
insert = """
    location = /coach-dialog-real-ai.html {
        alias /var/www/apk/coach-dialog-real-ai.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
p.write_text(text[:end] + insert + text[end:])
print("nginx: inserted coach-dialog-real-ai.html location")
PY
  nginx -t && systemctl reload nginx || true
fi

echo "==> Build Next tennis-ai"
cd "$ROOT"
if id tennis >/dev/null 2>&1; then
  chown -R tennis:tennis "$ROOT/.next" 2>/dev/null || true
  chown tennis:tennis \
    "$ROOT/components/coach-view.tsx" \
    "$ROOT/components/coach-picker.tsx" \
    "$ROOT/components/coach-tip-video.tsx" \
    "$ROOT/lib/coach.ts" \
    "$ROOT/lib/harmonix.ts" \
    "$ROOT/app/api/coach/chat/route.ts" 2>/dev/null || true
fi
if [[ -f package.json ]]; then
  if id tennis >/dev/null 2>&1; then
    sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  else
    npx next build --webpack || npm run build
  fi
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai || true
sleep 2
systemctl is-active tennis-ai || true
curl -sf -o /dev/null -w "tennis_http=%{http_code}\n" http://127.0.0.1:43127/tennis || true
echo "DONE coach-dialog-real-ai apply on $ROOT"
echo "Live: https://yqchen.blog/tennis/coach"
echo "Preview: https://yqchen.blog/coach-dialog-real-ai.html"
echo "Backup: $BACKUP"
echo "HA2 backup: $HA2_BACKUP"
echo "NOTE: feature-flags SHOW_ANALYSIS_TAB left untouched."
