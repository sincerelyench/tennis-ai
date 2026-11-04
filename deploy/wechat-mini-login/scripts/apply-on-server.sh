#!/usr/bin/env bash
# Apply WeChat mini-program login API to /opt/tennis-ai and optionally set env.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.wechat-mini-login-backup-$STAMP"
DROP_IN="/etc/systemd/system/tennis-ai.service.d/wechat-mp.conf"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/lib" "$BACKUP/app/api/auth"
cp -a "$ROOT/lib/auth-store.ts" "$BACKUP/lib/" 2>/dev/null || true
cp -a "$ROOT/middleware.ts" "$BACKUP/" 2>/dev/null || true
cp -a "$ROOT/app/api/auth" "$BACKUP/app/api/" 2>/dev/null || true

echo "==> Install opt-patch"
mkdir -p "$ROOT/lib" "$ROOT/app/api/auth/wechat"
cp -a "$PATCH_DIR/opt-patch/lib/auth-store.ts" "$ROOT/lib/auth-store.ts"
cp -a "$PATCH_DIR/opt-patch/middleware.ts" "$ROOT/middleware.ts"
cp -a "$PATCH_DIR/opt-patch/app/api/auth/wechat/route.ts" "$ROOT/app/api/auth/wechat/route.ts"

# Wire WECHAT_MP_* from voice-diary secrets only when tennis has none yet.
if [[ ! -f "$DROP_IN" ]]; then
  APPID="${WECHAT_MP_APPID:-}"
  SECRET="${WECHAT_MP_SECRET:-}"
  if [[ -z "$APPID" || -z "$SECRET" ]] && [[ -f /root/voice-diary-secrets/local.env ]]; then
    # shellcheck disable=SC1091
    set -a
    # Only pull WECHAT_* lines
    # shellcheck disable=SC1090
    eval "$(grep -E '^WECHAT_(APPID|SECRET)=' /root/voice-diary-secrets/local.env | sed 's/^WECHAT_APPID=/WECHAT_MP_APPID=/; s/^WECHAT_SECRET=/WECHAT_MP_SECRET=/')"
    set +a
    APPID="${WECHAT_MP_APPID:-}"
    SECRET="${WECHAT_MP_SECRET:-}"
  fi
  if [[ -n "$APPID" && -n "$SECRET" ]]; then
    echo "==> Writing systemd drop-in $DROP_IN (WECHAT_MP_APPID set)"
    mkdir -p "$(dirname "$DROP_IN")"
    cat > "$DROP_IN" <<EOF
[Service]
Environment=WECHAT_MP_APPID=$APPID
Environment=WECHAT_MP_SECRET=$SECRET
EOF
    systemctl daemon-reload
  else
    echo "==> No WECHAT_MP_APPID/SECRET — API will use mock openid fallback"
  fi
else
  echo "==> Keep existing $DROP_IN"
fi

echo "==> Build Next + restart"
cd "$ROOT"
if [[ -f package.json ]]; then
  sudo -u tennis npm run build
  systemctl restart tennis-ai
  systemctl is-active tennis-ai
fi

echo "==> Smoke /api/auth/wechat"
sleep 2
curl -sS -X POST "http://127.0.0.1:43127/tennis/api/auth/wechat" \
  -H "Content-Type: application/json" \
  -d '{"code":"dev-smoke-'"$STAMP"'","nickName":"涨球测试"}' | head -c 400
echo
echo "==> Done wechat-mini-login @ $STAMP"
