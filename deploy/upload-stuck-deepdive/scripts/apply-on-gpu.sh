#!/usr/bin/env bash
# Apply upload-stuck GPU nginx + busy middleware fixes.
set -euo pipefail
STAMP="$(date +%Y%m%d-%H%M%S)"
NGINX_CONF=/etc/nginx/default.d/tennis-ai.conf
APP_PY=/root/workspace/tennis-ai/web/app.py
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cp -a "$NGINX_CONF" "${NGINX_CONF}.bak-upload-stuck-$STAMP"
cp -a "$ROOT/patches/gpu-tennis-ai.conf" "$NGINX_CONF"

cp -a "$APP_PY" "${APP_PY}.bak-upload-stuck-$STAMP"
python3 - <<'PY'
from pathlib import Path
path = Path("/root/workspace/tennis-ai/web/app.py")
text = path.read_text()
old = '''@app.middleware("http")
async def analyze_busy_guard(request: Request, call_next):
    """Fail busy analyzes before multipart parse so phones do not upload into a 409."""
    path = request.url.path.rstrip("/")
    if request.method == "POST" and path.endswith("/api/analyze"):
        _reap_stale_jobs()
        if _busy_job():
            snap = _busy_snapshot()
            content = {"detail": "正在分析其他录像，请稍后再试", "code": "busy"}
            if snap:
                content["busy_job"] = snap
            return JSONResponse(status_code=409, content=content)
    return await call_next(request)
'''
new = '''@app.middleware("http")
async def analyze_busy_guard(request: Request, call_next):
    """Fail busy analyzes before multipart parse so phones do not upload into a 409."""
    path = request.url.path.rstrip("/")
    if request.method == "POST" and path.endswith("/api/analyze"):
        _reap_stale_jobs()
        if _busy_job():
            snap = _busy_snapshot()
            content = {"detail": "正在分析其他录像，请稍后再试", "code": "busy"}
            if snap:
                content["busy_job"] = snap
            # With proxy_request_buffering off, a 409 that never reads the body
            # leaves the blog→GPU stream half-open (client looks hung, then 499).
            try:
                await request.body()
            except Exception:
                pass
            return JSONResponse(status_code=409, content=content)
    return await call_next(request)
'''
if old not in text:
    if "await request.body()" in text and "analyze_busy_guard" in text:
        print("busy middleware already drains body")
    else:
        raise SystemExit("busy middleware block not found; refuse to patch")
else:
    path.write_text(text.replace(old, new, 1))
    print("patched analyze_busy_guard")
PY

nginx -t
systemctl reload nginx
systemctl restart tennis-ai.service
systemctl is-active tennis-ai.service nginx
grep -n proxy_request_buffering "$NGINX_CONF"
