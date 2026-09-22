#!/usr/bin/env bash
# 在 yqchen.blog 那台机器上，把 /tai 反代到已有的网球测评服务。
# 本机执行：
#   ssh root@8.216.53.29 'bash -s' < deploy/publish-yqchen-tai.sh
# 或已登录博客机后：
#   bash deploy/publish-yqchen-tai.sh

set -euo pipefail

SNIPPET_DST=/etc/nginx/snippets/yqchen-tai.conf
INCLUDE_LINE='include /etc/nginx/snippets/yqchen-tai.conf;'
MARKER='# tennis-ai /tai'

if [[ ! -f /etc/nginx/nginx.conf ]]; then
  echo "这台机器上没有 nginx，无法挂 yqchen.blog/tai" >&2
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
import re
import sys

include_line = "    include /etc/nginx/snippets/yqchen-tai.conf;"
marker = "# tennis-ai /tai"
roots = [Path("/etc/nginx")]
candidates = []
for root in roots:
    if not root.exists():
        continue
    for path in root.rglob("*"):
        if path.suffix not in {".conf", ""} and path.name != "nginx.conf":
            if path.suffix != ".conf":
                continue
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if re.search(r"server_name\s+[^;]*yqchen\.blog", text):
            candidates.append(path)

if not candidates:
    print("找不到 server_name 含 yqchen.blog 的 nginx 配置", file=sys.stderr)
    sys.exit(1)

# Prefer the file that already has the HTTPS server or /blog /tennis locations.
def score(path: Path) -> tuple:
    text = path.read_text(encoding="utf-8", errors="replace")
    return (
        1 if "listen 443" in text or "listen [::]:443" in text else 0,
        1 if "/blog" in text or "/tennis" in text else 0,
        -len(str(path)),
    )

target = sorted(candidates, key=score, reverse=True)[0]
text = target.read_text(encoding="utf-8")
if "snippets/yqchen-tai.conf" in text or "location ^~ /tai/" in text:
    print(f"已存在 /tai 配置: {target}")
    sys.exit(0)

# Insert the include into every server block that names yqchen.blog
# (80 跳转和 443 都要挂，否则 HTTPS 仍会 404).
pattern = re.compile(
    r"(server\s*\{(?:[^{}]|\{[^{}]*\})*?server_name\s+[^;]*yqchen\.blog[^;]*;)",
    re.S,
)
matches = list(pattern.finditer(text))
if not matches:
    print(f"{target} 里找不到 yqchen.blog 的 server 块", file=sys.stderr)
    sys.exit(1)

new_text = text
for match in reversed(matches):
    insert = match.group(1) + f"\n    {marker}\n{include_line}"
    new_text = new_text[: match.start(1)] + insert + new_text[match.end(1) :]
target.write_text(new_text, encoding="utf-8")
print(f"已写入 include × {len(matches)}: {target}")
PY

nginx -t
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  nginx -s reload
fi

echo "nginx 已 reload。检查 https://yqchen.blog/tai/"
curl -sS -o /dev/null -w "local /tai/ -> %{http_code}\n" --max-time 15 -H "Host: yqchen.blog" http://127.0.0.1/tai/ || true
