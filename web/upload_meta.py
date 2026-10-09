"""Shooting-guide metadata attached to an existing analysis job."""

from __future__ import annotations

import json

GUIDE_KEYS = ("side", "full_body", "racket")
E1_CLIENTS = frozenset({"miniprogram", "android", "e1"})
MAX_GUIDE_JSON = 2000
MAX_CLIENT_LEN = 32
ALLOWED_VIDEO_SUFFIXES = {".mp4", ".mov", ".webm", ".m4v", ".avi"}
MAX_VIDEO_BYTES = 400 * 1024 * 1024
MIN_VIDEO_BYTES = 1000


class GuideError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def parse_client(raw: str | None) -> str:
    client = (raw or "").strip().lower()
    if len(client) > MAX_CLIENT_LEN:
        raise GuideError("bad_client", "无法识别客户端")
    return client


def parse_guide_flag(raw: str | None) -> bool | None:
    if raw is None or str(raw).strip() == "":
        return None
    val = str(raw).strip().lower()
    if val in {"1", "true", "yes"}:
        return True
    if val in {"0", "false", "no"}:
        return False
    raise GuideError("guide_invalid", "拍摄引导数据无法识别")


def parse_guide_checks(raw: str | None) -> dict | None:
    if raw is None or str(raw).strip() == "":
        return None
    text = str(raw)
    if len(text) > MAX_GUIDE_JSON:
        raise GuideError("guide_too_long", "拍摄引导数据过长")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GuideError("guide_invalid", "拍摄引导数据无法识别") from exc
    if not isinstance(data, dict):
        raise GuideError("guide_invalid", "拍摄引导数据无法识别")
    return {key: bool(data.get(key)) for key in GUIDE_KEYS}


def build_job_metadata(
    *,
    client: str,
    checks: dict | None,
    claimed: bool | None,
    user: dict | None,
) -> dict | None:
    if client not in E1_CLIENTS and checks is None and claimed is None and not user:
        return None
    if checks is not None:
        checks_out = {key: bool(checks.get(key)) for key in GUIDE_KEYS}
        completed = all(checks_out.values())
    elif client in E1_CLIENTS:
        checks_out = {key: False for key in GUIDE_KEYS}
        completed = False
    else:
        checks_out = None
        completed = claimed
    meta: dict = {}
    if client:
        meta["client"] = client
    if completed is not None:
        meta["guide_completed"] = bool(completed)
    if checks_out is not None:
        meta["guide_checks"] = checks_out
    if user:
        meta["user_id"] = user.get("sub")
        meta["auth"] = user.get("kind") or "dev-mock"
    return meta or None


def video_rejection(suffix: str, size: int) -> tuple[str, str] | None:
    if suffix not in ALLOWED_VIDEO_SUFFIXES:
        return ("video_type", "请上传 mp4 / mov / webm 视频")
    if size < MIN_VIDEO_BYTES:
        return ("video_too_small", "视频文件太小或已损坏")
    if size > MAX_VIDEO_BYTES:
        return ("video_too_large", "视频超过 400MB")
    return None
