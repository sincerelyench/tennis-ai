#!/usr/bin/env bash
# Run on 8.216.53.29 — auth gate + nginx /tai + recent tennis-ai / GPU hints.
set -euo pipefail
ROOT="${1:-/opt/tennis-ai}"

echo "== tennis-ai service =="
systemctl is-active tennis-ai || true
systemctl status tennis-ai --no-pager -l | head -25 || true

echo
echo "== layout / middleware session redirects =="
rg -n "getSession|redirect\(.*login|cookies\(|sessionCookie|force-dynamic" \
  "$ROOT/app" "$ROOT/middleware.ts" "$ROOT/src" 2>/dev/null | head -80 || true

echo
echo "== trim-file / tai timeout (hotfix #55) =="
rg -n "duration > 20|Submit only 10|900_000|180_000|proxy_request_buffering" \
  "$ROOT/lib/trim-file.ts" "$ROOT/lib/tai.ts" "$ROOT/components/analysis-view.tsx" \
  /etc/nginx/snippets/yqchen-tai.conf /etc/nginx/conf.d 2>/dev/null | head -40 || true

echo
echo "== nginx tai snippet =="
if [[ -f /etc/nginx/snippets/yqchen-tai.conf ]]; then
  cat /etc/nginx/snippets/yqchen-tai.conf
else
  echo "MISSING /etc/nginx/snippets/yqchen-tai.conf"
  rg -n "location /tai|proxy_request_buffering|client_body_timeout" /etc/nginx -g '*.conf' | head -40 || true
fi

echo
echo "== recent access: /tai/api/analyze =="
rg " /tai/api/analyze" /var/log/nginx/access.log 2>/dev/null | tail -30 || \
  rg " /tai/api/analyze" /var/log/nginx/*.log 2>/dev/null | tail -30 || true

echo
echo "== journal tennis-ai (auth/session) =="
journalctl -u tennis-ai -n 80 --no-pager | tail -80 || true

echo
echo "== local smoke: login + HTML gate =="
CODE_JSON=$(curl -sS -H 'content-type: application/json' -d '{"phone":"13800138000"}' \
  http://127.0.0.1:43127/api/auth/code || true)
echo "code: $CODE_JSON"
CODE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('code',''))" <<<"$CODE_JSON" 2>/dev/null || true)
rm -f /tmp/zq-auth-gate.txt
if [[ -n "$CODE" ]]; then
  curl -sS -c /tmp/zq-auth-gate.txt -H 'content-type: application/json' \
    -d "{\"phone\":\"13800138000\",\"code\":\"$CODE\"}" \
    http://127.0.0.1:43127/api/auth/login | tee /tmp/zq-login.json
  echo
  curl -sS -b /tmp/zq-auth-gate.txt http://127.0.0.1:43127/api/auth/session; echo
  echo -n "HTML /analysis via loopback: "
  curl -sS -b /tmp/zq-auth-gate.txt -o /dev/null -w "%{http_code} %{redirect_url}\n" \
    http://127.0.0.1:43127/analysis || true
fi

echo
echo "== public gate =="
curl -sS -o /dev/null -w "public /tennis/analysis: %{http_code} %{redirect_url}\n" \
  -b /tmp/zq-auth-gate.txt https://yqchen.blog/tennis/analysis || true
