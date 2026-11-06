#!/usr/bin/env bash
# Remove busy middleware full-body drain (made 409 wait for entire upload).
set -euo pipefail
APP_PY=/root/workspace/tennis-ai/web/app.py
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -a "$APP_PY" "${APP_PY}.bak-submission-timeout-$STAMP"
python3 - <<'PY'
from pathlib import Path
path = Path("/root/workspace/tennis-ai/web/app.py")
text = path.read_text()
old = '''            if snap:
                content["busy_job"] = snap
            # With proxy_request_buffering off, a 409 that never reads the body
            # leaves the blog→GPU stream half-open (client looks hung, then 499).
            try:
                await request.body()
            except Exception:
                pass
            return JSONResponse(status_code=409, content=content)
'''
new = '''            if snap:
                content["busy_job"] = snap
            # Do not await request.body() — that forced a full phone upload into
            # a 409 (~2min). Client pingTai().busy already fail-fasts.
            return JSONResponse(
                status_code=409,
                content=content,
                headers={"Connection": "close"},
            )
'''
if old not in text:
    if "Connection\": \"close\"" in text and "analyze_busy_guard" in text:
        print("already fixed")
    elif "await request.body()" not in text.split("analyze_busy_guard", 1)[-1].split("return await call_next", 1)[0]:
        print("no body drain present")
    else:
        raise SystemExit("busy middleware pattern not found")
else:
    path.write_text(text.replace(old, new, 1))
    print("patched busy middleware")
PY
systemctl restart tennis-ai.service
systemctl is-active tennis-ai.service
sed -n '509,535p' "$APP_PY"
