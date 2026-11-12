#!/usr/bin/env bash
# ZQ-104 DB cleanup — BLOCKED without Yanqing prior OK.
# Prefer UI/API list dedupe (friends-view + match-intros listIntrosForUser).
# Do NOT run DELETE / blob rewrite on live tennis_ai until explicitly approved.
set -euo pipefail

echo "REFUSED: live DB cleanup requires Yanqing prior OK."
echo "UI/API dedupe only. If cleanup is still needed, ask via Project coordinator."
exit 2
