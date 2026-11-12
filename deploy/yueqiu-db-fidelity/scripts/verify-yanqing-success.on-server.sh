#!/usr/bin/env bash
# Read-only: compare DB success intros vs API for 陈燕青 / 袁啸
set -euo pipefail
cd /opt/tennis-ai
set -a
# shellcheck disable=SC1091
source .env
set +a

python3 <<'PY'
import json, os, subprocess, urllib.request, http.cookiejar

url = os.environ["TENNIS_DATABASE_URL"]

def q(sql: str) -> str:
    return subprocess.check_output(
        ["psql", url, "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql],
        text=True,
    )

blob = json.loads(q("SELECT payload::text FROM match_intros_blob LIMIT 1;").strip())
intros = blob.get("intros") or []

def is_success(i):
    if i.get("status") in ("cancelled", "awaiting_accept"):
        return False
    if i.get("acceptedAt"):
        return True
    return i.get("status") == "pending"

# DB rows that look like Yanqing↔袁啸/元孝 success
db_hits = []
for i in intros:
    names = f"{i.get('fromName','')}|{i.get('toName','')}"
    if not any(x in names for x in ("袁啸", "元孝")):
        continue
    if not is_success(i):
        continue
    if "陈燕青" in names or i.get("fromPhone") in ("18662147197", "u_111"):
        db_hits.append(i)

print("DB_SUCCESS_YUANXIAO", len(db_hits))
for i in db_hits:
    print(
        json.dumps(
            {
                "id": i.get("id"),
                "status": i.get("status"),
                "fromPhone": i.get("fromPhone"),
                "fromName": i.get("fromName"),
                "toPhone": i.get("toPhone"),
                "toName": i.get("toName"),
                "acceptedAt": i.get("acceptedAt"),
            },
            ensure_ascii=False,
        )
    )

# Login + API
code_body = json.dumps({"phone": "18662147197"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:43127/tennis/api/auth/code",
    data=code_body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=20) as r:
    code = json.load(r)["code"]

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
login_body = json.dumps({"phone": "18662147197", "code": code}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:43127/tennis/api/auth/login",
    data=login_body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with opener.open(req, timeout=20) as r:
    login = json.load(r)
assert login.get("ok"), login

req = urllib.request.Request(
    "http://127.0.0.1:43127/tennis/api/friends/intros",
    headers={"Accept-Language": "zh-CN"},
)
with opener.open(req, timeout=20) as r:
    data = json.load(r)

success = data.get("success") or []
print("API_SUCCESS_COUNT", len(success))
for row in success:
    print(
        json.dumps(
            {
                "id": row.get("id"),
                "opponentName": row.get("opponentName"),
                "toName": row.get("toName"),
                "fromName": row.get("fromName"),
                "status": row.get("status"),
                "acceptedAt": row.get("acceptedAt"),
                "matchSuccess": row.get("matchSuccess"),
            },
            ensure_ascii=False,
        )
    )

api_ids = {row.get("id") for row in success}
missing = [i["id"] for i in db_hits if i.get("id") not in api_ids]
print("MISSING_YUANXIAO_IN_API", missing)
print("HAS_YUANXIAO_OR_YUANXIAO_NAME", any(
    ("袁" in str(row.get("opponentName") or ""))
    or ("元" in str(row.get("opponentName") or ""))
    or ("袁" in str(row.get("toName") or ""))
    or ("元" in str(row.get("toName") or ""))
    for row in success
))
if missing:
    raise SystemExit(2)
print("VERIFY_OK")
PY
