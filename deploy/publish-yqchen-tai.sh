#!/usr/bin/env bash
# 在 yqchen.blog 那台机器上，把 /tai 反代到已有的网球测评 GPU 服务。
# 现网 HTTPS 落在 /etc/nginx/conf.d/ipitch.conf 的 default_server
#（server_name 是 ipitch，不是 yqchen.blog）。
# 本机执行：
#   ssh root@8.216.53.29 'bash -s' < deploy/publish-yqchen-tai.sh

set -euo pipefail

SNIPPET_DST=/etc/nginx/snippets/yqchen-tai.conf
TARGET=/etc/nginx/conf.d/ipitch.conf

if [[ ! -f /etc/nginx/nginx.conf ]]; then
  echo "这台机器上没有 nginx，无法挂 yqchen.blog/tai" >&2
  exit 1
fi
if [[ ! -f "$TARGET" ]]; then
  echo "找不到 $TARGET" >&2
  exit 1
fi

mkdir -p /etc/nginx/snippets

if [[ -f /opt/tennis-ai/deploy/nginx-yqchen-blog-tai.conf ]]; then
  src=/opt/tennis-ai/deploy/nginx-yqchen-blog-tai.conf
elif [[ -f "$(dirname "$0")/nginx-yqchen-blog-tai.conf" ]]; then
  src="$(cd "$(dirname "$0")" && pwd)/nginx-yqchen-blog-tai.conf"
else
  echo "找不到 nginx-yqchen-blog-tai.conf" >&2
  exit 1
fi

cp "$src" "$SNIPPET_DST"

python3 - <<'PY'
from pathlib import Path

path = Path("/etc/nginx/conf.d/ipitch.conf")
text = path.read_text(encoding="utf-8")
needle = "include /etc/nginx/snippets/yqchen-tai.conf;"
if needle in text:
    print(f"已存在 /tai include: {path}")
else:
    insert = (
        "    # tennis-ai /tai (GPU service on 47.93.203.28)\n"
        "    include /etc/nginx/snippets/yqchen-tai.conf;\n\n"
    )
    for anchor in (
        "    # 网球智能训练 (Next.js basePath=/tennis).",
        "    location /tennis {",
        "    location / {",
    ):
        if anchor in text:
            path.write_text(text.replace(anchor, insert + anchor, 1), encoding="utf-8")
            print(f"已写入 include: {path}")
            break
    else:
        raise SystemExit(f"{path} 里找不到可插入的锚点")
PY

nginx -t
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  nginx -s reload
fi

echo "nginx 已 reload。检查 https://yqchen.blog/tai/"
curl -sS -o /dev/null -w "https /tai/ -> %{http_code}\n" --max-time 15 https://yqchen.blog/tai/ || true
curl -sS -o /dev/null -w "https /tai/api/health -> %{http_code}\n" --max-time 15 https://yqchen.blog/tai/api/health || true
