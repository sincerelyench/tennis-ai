#!/usr/bin/env bash
# Run on yanqing MacBook Pro (Keychain voice-diary-prod-ssh).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
EVIDENCE_DIR="${EVIDENCE_DIR:-$DIR/../../}"
bash "$DIR/apply-gpu.sh"

PHONE="${PROBE_PHONE:-13900001390}"
TINY="${TINY_MP4:-}"
if [[ -z "$TINY" ]]; then
  TINY=$(mktemp /tmp/zq-tinyXXXX.mp4)
  ffmpeg -y -f lavfi -i color=c=black:s=320x240:d=1 -c:v libx264 -t 1 -pix_fmt yuv420p "$TINY" >/dev/null 2>&1
fi
CODE=$(curl -sS -X POST "https://yqchen.blog/tennis/api/auth/code" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['code'])")
LOGIN=$(curl -sS -X POST "https://yqchen.blog/tennis/api/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\",\"role\":\"player\"}")
TOKEN=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['token'])" "$LOGIN")
OUT="$EVIDENCE_DIR/after-mp-client.json"
CODE_HTTP=$(curl -sS -o "$OUT" -w "%{http_code}" -X POST "https://yqchen.blog/tennis/api/analyze" \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@${TINY};type=video/mp4" -F "stroke=forehand" -F "sample=0" -F "client=miniprogram" -F "fast=1")
echo "after miniprogram analyze HTTP=$CODE_HTTP"
python3 -c "import json;d=json.load(open('$OUT'));print({k:d.get(k) for k in ['job_id','cached','status','code','detail']})"
[[ "$CODE_HTTP" == "200" ]] || exit 1
echo "OK — user can retry now (GPU-only; no APK/IPA/mp rebuild required)."
