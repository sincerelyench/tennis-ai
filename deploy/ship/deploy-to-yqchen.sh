#!/usr/bin/env bash
# Deploy 涨球 download landing + WeChat mp zip (2026-10-20 current pack) to yqchen.blog.
# Cloud VMs often lack SSH keys — run from a machine with root SSH (e.g. yanqing Mac).
#
# Usage:
#   bash deploy-to-yqchen.sh
#   HOST=root@8.216.53.29 bash deploy-to-yqchen.sh
#
# Public URLs after success:
#   https://yqchen.blog/mp-weixin.zip
#   https://yqchen.blog/mp-weixin-README.txt
#   https://yqchen.blog/get-zhangqiu.html

set -euo pipefail

HOST="${HOST:-root@8.216.53.29}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REMOTE_APK=/var/www/apk
REMOTE_SNIPPET=/etc/nginx/snippets/zhangqiu-get.conf
IPITCH=/etc/nginx/conf.d/ipitch.conf

need=(get-zhangqiu.html mp-weixin.zip mp-weixin-README.txt nginx-zhangqiu-get.conf)
for f in "${need[@]}"; do
  [[ -f "$HERE/$f" ]] || { echo "missing $HERE/$f" >&2; exit 1; }
done

echo "==> upload artifacts to $HOST:$REMOTE_APK"
ssh -o BatchMode=yes "$HOST" "mkdir -p '$REMOTE_APK'"
scp -o BatchMode=yes \
  "$HERE/get-zhangqiu.html" \
  "$HERE/mp-weixin.zip" \
  "$HERE/mp-weixin-README.txt" \
  "$HOST:$REMOTE_APK/"

echo "==> install nginx snippet"
scp -o BatchMode=yes "$HERE/nginx-zhangqiu-get.conf" "$HOST:$REMOTE_SNIPPET"

ssh -o BatchMode=yes "$HOST" bash -s <<'REMOTE'
set -euo pipefail
IPITCH=/etc/nginx/conf.d/ipitch.conf
NEEDLE='include /etc/nginx/snippets/zhangqiu-get.conf;'
if ! grep -Fq "$NEEDLE" "$IPITCH"; then
  python3 - <<'PY'
from pathlib import Path
path = Path("/etc/nginx/conf.d/ipitch.conf")
text = path.read_text(encoding="utf-8")
insert = "    include /etc/nginx/snippets/zhangqiu-get.conf;\n\n"
for anchor in (
    "    # 网球智能训练 (Next.js basePath=/tennis).",
    "    location /tennis {",
    "    location / {",
):
    if anchor in text:
        path.write_text(text.replace(anchor, insert + anchor, 1), encoding="utf-8")
        print(f"inserted include before: {anchor.strip()}")
        break
else:
    raise SystemExit("could not find insert anchor in ipitch.conf")
PY
else
  echo "nginx include already present"
fi
nginx -t
systemctl reload nginx
echo "deployed files:"
ls -la /var/www/apk/get-zhangqiu.html /var/www/apk/mp-weixin.zip /var/www/apk/mp-weixin-README.txt
REMOTE

echo "==> verify public URLs"
for u in \
  https://yqchen.blog/get-zhangqiu.html \
  https://yqchen.blog/zhangqiu \
  https://yqchen.blog/mp-weixin.zip \
  https://yqchen.blog/mp-weixin-README.txt \
  https://yqchen.blog/tennis \
  https://yqchen.blog/tennis-ai.apk
do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$u" || echo ERR)
  echo "$code  $u"
done

echo "done."
