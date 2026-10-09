"""Development mock login: code → signed token.

正式微信登录不在这里。本模块不会请求微信 jscode2session。
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

TOKEN_TTL_S = 7 * 24 * 3600
_DEFAULT_SECRET = "zhangqiu-dev-mock"


def _secret() -> str:
    value = os.environ.get("DEV_AUTH_SECRET", "").strip()
    return value or _DEFAULT_SECRET


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(raw: str) -> bytes:
    pad = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + pad)


def issue_dev_token(code: str, *, now: int | None = None) -> dict:
    issued = int(time.time() if now is None else now)
    user_id = "dev_" + hashlib.sha256(code.encode("utf-8")).hexdigest()[:12]
    payload = {
        "sub": user_id,
        "iat": issued,
        "exp": issued + TOKEN_TTL_S,
        "kind": "dev-mock",
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(_secret().encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return {
        "token": f"v1.{body}.{sig}",
        "token_type": "Bearer",
        "expires_in": TOKEN_TTL_S,
        "login_mode": "dev-mock",
        "notice_code": "dev_mock",
        "notice": "当前为开发态模拟登录，正式微信登录将在后续版本接入。",
        "user": {"id": user_id},
    }


def verify_dev_token(token: str | None, *, now: int | None = None) -> dict | None:
    if not token or token.count(".") != 2:
        return None
    version, body, sig = token.split(".")
    if version != "v1" or not body or not sig:
        return None
    expected = hmac.new(_secret().encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_b64decode(body))
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp")
    sub = payload.get("sub")
    if not isinstance(exp, int) or not isinstance(sub, str) or not sub:
        return None
    current = int(time.time() if now is None else now)
    if current >= exp:
        return None
    return payload


def bearer_token(header: str | None) -> str | None:
    """Return the token, '' when the header is present but malformed, None when absent."""
    if header is None or not str(header).strip():
        return None
    parts = str(header).strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
        return parts[1].strip()
    return ""
