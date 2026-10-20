#!/usr/bin/env bash
# Convenience wrapper — same as scripts/apply-on-server.sh
exec "$(cd "$(dirname "$0")" && pwd)/scripts/apply-on-server.sh" "$@"
