#!/usr/bin/env bash
# Apply APK/web WeChat login patches to /opt/tennis-ai
set -euo pipefail
ROOT="${1:-/opt/tennis-ai}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_DIR="$HERE"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.apk-wechat-login-backup-$STAMP"
DROP_IN="/etc/systemd/system/tennis-ai.service.d/wechat-app.conf"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP"
for rel in \
  components/login-view.tsx \
  lib/auth-store.ts \
  lib/auth-http.ts \
  lib/i18n/messages.ts \
  middleware.ts \
  app/api/auth/wechat/route.ts \
  app/api/auth/wechat-app/route.ts
do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$ROOT/$rel" "$BACKUP/$rel"
  fi
done

echo "==> Copy opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/lib/i18n" "$ROOT/components" \
  "$ROOT/app/api/auth/wechat" "$ROOT/app/api/auth/wechat-app"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/lib/auth-http.ts" "$ROOT/lib/auth-http.ts"
cp -a "$PATCH_DIR/opt-patch/components/login-view.tsx" "$ROOT/components/login-view.tsx"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/wechat/route.ts" "$ROOT/app/api/auth/wechat/route.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/wechat-app/route.ts" "$ROOT/app/api/auth/wechat-app/route.ts"
if [[ -f "$PATCH_DIR/opt-patch/middleware.ts" ]]; then
  cp -a "$PATCH_DIR/opt-patch/middleware.ts" "$ROOT/middleware.ts"
fi

echo "==> Merge WeChat login i18n keys into messages.ts"
TENNIS_ROOT="$ROOT" python3 "$HERE/scripts/patch-wechat-i18n.py"

# Optional mobile Open Platform credentials (do not overwrite if already set)
if [[ ! -f "$DROP_IN" ]]; then
  APP_ID="${WECHAT_APP_APPID:-}"
  APP_SECRET="${WECHAT_APP_SECRET:-}"
  if [[ -n "$APP_ID" && -n "$APP_SECRET" ]]; then
    echo "==> Writing $DROP_IN"
    mkdir -p "$(dirname "$DROP_IN")"
    cat > "$DROP_IN" <<EOF
[Service]
Environment=WECHAT_APP_APPID=$APP_ID
Environment=WECHAT_APP_SECRET=$APP_SECRET
EOF
    systemctl daemon-reload
  else
    echo "==> No WECHAT_APP_APPID/SECRET — Android OpenSDK will use mock/fallback codes"
  fi
else
  echo "==> Keep existing $DROP_IN"
fi

echo "==> Build Next"
cd "$ROOT"
if [[ -f package-lock.json ]]; then
  npm run build
else
  npm run build
fi

echo "==> Restart tennis-ai"
systemctl restart tennis-ai
sleep 2
systemctl is-active tennis-ai

echo "==> Smoke wechat + wechat-app"
curl -sS -X POST "http://127.0.0.1:43127/tennis/api/auth/wechat" \
  -H "content-type: application/json" \
  -d '{"code":"apk_smoke_device","client":"android"}' | head -c 400
echo
curl -sS -X POST "http://127.0.0.1:43127/tennis/api/auth/wechat-app" \
  -H "content-type: application/json" \
  -d '{"code":"apk_smoke_oauth","client":"android"}' | head -c 400
echo
echo "==> Done apk-wechat-login @ $STAMP"
