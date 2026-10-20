#!/usr/bin/env bash
# One-shot Mac deploy: GPU /tai + Web + APK + IPA + mp-weixin.
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

echo "======== 4/4 Latency probe ========"
EVIDENCE_DIR="${EVIDENCE_DIR:-}" bash "$DIR/probe-latency.sh" || true

echo
echo "All four surfaces requested:"
echo "  Web     https://yqchen.blog/tennis  +  https://yqchen.blog/tai"
echo "  APK     https://yqchen.blog/tennis-ai.apk"
echo "  IPA     https://yqchen.blog/tennis-ai.ipa"
echo "  WeChat  https://yqchen.blog/mp-weixin.zip  (+ README)"
echo DONE
