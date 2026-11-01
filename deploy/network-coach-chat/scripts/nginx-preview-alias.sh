#!/usr/bin/env bash
set -euo pipefail
CONF=/etc/nginx/conf.d/ipitch.conf
HTML=/var/www/apk/network-coach-chat.html
[[ -f "$HTML" ]] || { echo "missing $HTML"; exit 1; }
if grep -q 'network-coach-chat.html' "$CONF"; then
  echo "nginx already has alias"
else
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/nginx/conf.d/ipitch.conf")
t = p.read_text()
block = """
    location = /network-coach-chat.html {
        alias /var/www/apk/network-coach-chat.html;
        add_header Cache-Control "no-cache";
        default_type text/html;
    }
"""
needle = "location = /tennis-ai.apk"
if needle not in t:
    raise SystemExit("needle missing")
t = t.replace(needle, block + "\n    " + needle, 1)
p.write_text(t)
print("nginx patched")
PY
  nginx -t
  systemctl reload nginx
fi
curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" -H "Host: yqchen.blog" http://127.0.0.1/network-coach-chat.html || true
