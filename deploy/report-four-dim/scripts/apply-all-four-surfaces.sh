#!/usr/bin/env bash
# One-shot Mac deploy: GPU /tai + Web Next + APK/IPA/mp-weixin
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======== 1/4 GPU /tai ========"
bash "$DIR/apply-gpu.sh"

echo "======== 2/4 Web (Next + uni-app src) ========"
bash "$DIR/apply-web.sh"

if [[ "${SKIP_NATIVE:-0}" == "1" ]]; then
  echo "SKIP_NATIVE=1 — not rebuilding APK/IPA/mp-weixin"
else
  echo "======== 3/4 Native packs (APK + IPA + mp-weixin) ========"
  bash "$DIR/build-and-upload-native.sh"
fi

echo "======== 4/4 Public checks ========"
for u in \
  "https://yqchen.blog/tennis/report-four-dim-preview.html" \
  "https://yqchen.blog/tennis-ai.apk" \
  "https://yqchen.blog/tennis-ai.ipa" \
  "https://yqchen.blog/mp-weixin.zip"
do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L "$u" || echo ERR)
  echo "  $code  $u"
done

echo
echo "All four surfaces requested:"
echo "  Web     https://yqchen.blog/tennis  (+ report-four-dim-preview.html)"
echo "  APK     https://yqchen.blog/tennis-ai.apk"
echo "  IPA     https://yqchen.blog/tennis-ai.ipa"
echo "  WeChat  https://yqchen.blog/mp-weixin.zip  (+ README)"
echo DONE
