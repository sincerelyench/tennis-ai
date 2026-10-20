#!/usr/bin/env bash
# 涨球 · Mac four-surface release for report four-dim + speed
# Run on yanqing MacBook Pro (Keychain voice-diary-prod-ssh + sshpass).
#
# Usage:
#   bash deploy/report-four-dim/scripts/mac-four-surface-release.sh
#   LOCAL_APK=... LOCAL_IPA=... LOCAL_MP_ZIP=... \
#     bash deploy/report-four-dim/scripts/mac-four-surface-release.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/apply-all-four-surfaces.sh"
