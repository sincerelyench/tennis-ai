"""Upload a tennis video and return a coaching report."""

from __future__ import annotations

import hashlib
import json
import os
import queue
import shutil
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.cursor_client import warm_agent
from pipeline.level import DEFAULT_LEVEL, parse_level, public_levels
from pipeline.oss import refresh_report_urls
from pipeline.session import FAST_MAX_SECONDS, analyze_video, get_detector, get_estimator, json_default
from pipeline.stroke import normalize_stroke
from web.api_errors import CodedHTTPException, coded_handler
from web.dev_auth import bearer_token, issue_dev_token, verify_dev_token
from web.history import archive_report, find_archive, list_history
from web.progress import assemble_result, entry_from, list_entries, stroke_of, upsert_entry, user_id_of
from web.upload_meta import (
    E1_CLIENTS,
    GuideError,
    build_job_metadata,
    parse_client,
    parse_guide_checks,
    parse_guide_flag,
    video_rejection,
)

JOBS_DIR = ROOT / "outputs" / "jobs"
REPORTS_DIR = ROOT / "outputs" / "reports"
PROGRESS_DIR = ROOT / "outputs" / "progress"
SAMPLE_CACHE_DIR = ROOT / "outputs" / "sample_cache"
CONTENT_CACHE_DIR = ROOT / "outputs" / "content_cache"
STATIC_DIR = Path(__file__).resolve().parent / "static"
I18N_DIR = ROOT / "i18n"
E1_ASSETS = {"e1.css": "text/css", "e1.js": "text/javascript"}
SAMPLE_CANDIDATES = [
    ROOT / "samples" / "demo.mp4",
]
SAMPLE_CACHE_VERSION = "2.8-player-level"
CONTENT_CACHE_VERSION = "1.0-fast"
AUTO_FAST_MAX_SECONDS = 10.5

JOBS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
CONTENT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_jobs: dict[str, dict] = {}
_lock = threading.Lock()
_queue: queue.Queue[str] = queue.Queue()
_worker_started = False
_TERMINAL = {"done", "error", "cancelled"}
# Running/queued jobs with no progress update for this long are treated as dead
# so a crashed worker cannot leave /api/analyze stuck returning 409 forever.
STALE_JOB_S = int(os.environ.get("TAI_STALE_JOB_S", "1200"))
# Parallel analyze: multiple worker threads share one GPU lock (see pipeline.session).
# L20-2Q is ~2GB so default workers=2 (pose can overlap coaching on the other job).
WORKER_COUNT = max(1, int(os.environ.get("TAI_WORKERS", "2")))
MAX_JOBS = max(WORKER_COUNT, int(os.environ.get("TAI_MAX_JOBS", "8")))


def _sample_path() -> Path | None:
    for p in SAMPLE_CANDIDATES:
        if p.exists():
            return p
    return None


def _sample_fingerprint(src: Path, stroke: str, level: str = DEFAULT_LEVEL) -> str:
    st = src.stat()
    raw = f"{SAMPLE_CACHE_VERSION}|{src.resolve()}|{st.st_mtime_ns}|{st.st_size}|{stroke}|{level}|60"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _sample_cache_dir(src: Path, stroke: str, level: str = DEFAULT_LEVEL) -> Path:
    return SAMPLE_CACHE_DIR / _sample_fingerprint(src, stroke, level)


def _load_sample_cache(src: Path, stroke: str, level: str = DEFAULT_LEVEL) -> Path | None:
    cache = _sample_cache_dir(src, stroke, level)
    if (cache / "report.json").is_file():
        return cache
    return None


def _clear_sample_cache(src: Path, stroke: str, level: str = DEFAULT_LEVEL) -> None:
    cache = _sample_cache_dir(src, stroke, level)
    if cache.is_dir():
        shutil.rmtree(cache, ignore_errors=True)


def _content_fingerprint(digest: str, stroke: str, level: str, mode: str) -> str:
    raw = f"{CONTENT_CACHE_VERSION}|{digest}|{stroke}|{level}|{mode}"
    return hashlib.sha256(raw.encode()).hexdigest()[:20]


def _content_cache_dir(digest: str, stroke: str, level: str, mode: str) -> Path:
    return CONTENT_CACHE_DIR / _content_fingerprint(digest, stroke, level, mode)


def _load_content_cache(digest: str, stroke: str, level: str, mode: str) -> Path | None:
    cache = _content_cache_dir(digest, stroke, level, mode)
    if (cache / "report.json").is_file():
        return cache
    return None


def _save_content_cache(job_id: str, digest: str, stroke: str, level: str, mode: str) -> None:
    cache = _content_cache_dir(digest, stroke, level, mode)
    cache.mkdir(parents=True, exist_ok=True)
    job_dir = JOBS_DIR / job_id
    report = job_dir / "report.json"
    if report.is_file():
        shutil.copy2(report, cache / "report.json")
    kf_src = job_dir / "keyframes"
    if kf_src.is_dir():
        kf_dst = cache / "keyframes"
        if kf_dst.exists():
            shutil.rmtree(kf_dst, ignore_errors=True)
        shutil.copytree(kf_src, kf_dst)
    for name in ("preview.jpg", "cover.jpg"):
        src = job_dir / name
        if src.is_file():
            shutil.copy2(src, cache / name)


def _install_report_cache(job_id: str, cache: Path) -> dict:
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    report = cache / "report.json"
    if report.is_file():
        shutil.copy2(report, job_dir / "report.json")
    kf_src = cache / "keyframes"
    if kf_src.is_dir():
        kf_dst = job_dir / "keyframes"
        if kf_dst.exists():
            shutil.rmtree(kf_dst, ignore_errors=True)
        shutil.copytree(kf_src, kf_dst)
    for name in ("preview.jpg", "cover.jpg"):
        src = cache / name
        if src.is_file():
            shutil.copy2(src, job_dir / name)
    data = json.loads((job_dir / "report.json").read_text(encoding="utf-8"))
    overall = data.get("overall") or {}
    return {
        "score": overall.get("score"),
        "n_swings": overall.get("n_swings"),
        "source_name": data.get("source_name"),
        "analyze_mode": data.get("analyze_mode") or "fast",
        "report": data,
    }


def _video_duration_s(path: Path) -> float:
    cap = None
    try:
        import cv2

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return 0.0
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        n = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
        if fps > 1e-3 and n > 0:
            return n / fps
    except Exception:
        return 0.0
    finally:
        if cap is not None:
            cap.release()
    return 0.0


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}



def _save_sample_cache(job_id: str, src: Path, stroke: str, level: str = DEFAULT_LEVEL) -> None:
    job_dir = JOBS_DIR / job_id
    report = job_dir / "report.json"
    if not report.is_file():
        return
    cache = _sample_cache_dir(src, stroke, level)
    cache.mkdir(parents=True, exist_ok=True)
    shutil.copy2(report, cache / "report.json")
    preview = job_dir / "preview.jpg"
    if preview.is_file():
        shutil.copy2(preview, cache / "preview.jpg")


def _install_sample_cache(job_id: str, cache: Path) -> dict:
    out = JOBS_DIR / job_id
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cache / "report.json", out / "report.json")
    preview = cache / "preview.jpg"
    if preview.is_file():
        shutil.copy2(preview, out / "preview.jpg")
    report = json.loads((out / "report.json").read_text(encoding="utf-8"))
    overall = report.get("overall") or {}
    return {
        "score": overall.get("score"),
        "n_swings": overall.get("n_swings"),
        "source_name": report.get("source_name") or "demo.mp4",
    }


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _public_job(job: dict) -> dict:
    out = {k: v for k, v in job.items() if k != "video_path"}
    out.update(_eta_fields(job))
    return out


def _eta_fields(job: dict) -> dict:
    mode = str(job.get("analyze_mode") or "full")
    if mode == "fast":
        steps = [
            {"step": 1, "name": "读取视频", "seconds": 2, "label": "约 2 秒"},
            {"step": 2, "name": "识别动作", "seconds": 6, "label": "约 6 秒"},
            {"step": 3, "name": "找出挥拍", "seconds": 1, "label": "约 1 秒"},
            {"step": 4, "name": "整理数据", "seconds": 1, "label": "约 1 秒"},
            {"step": 5, "name": "教练点评", "seconds": 1, "label": "约 1 秒"},
        ]
        remain = max(0, int(sum(s["seconds"] for s in steps) * (1 - float(job.get("progress") or 0) / 100.0)))
        return {"eta_steps": steps, "eta_remaining_s": remain, "eta_hint": "快速分析约 10 秒内", "analyze_mode": mode}
    duration = float(job.get("max_seconds") or 0)
    if duration <= 0:
        duration = 90.0
    pose_s = int(max(90, duration * 4))
    steps = [
        {"step": 1, "name": "读取视频", "seconds": 15, "label": "约 15 秒"},
        {
            "step": 2,
            "name": "识别动作",
            "seconds": pose_s,
            "label": f"约 {max(1, round(pose_s / 60))} 分钟",
        },
        {"step": 3, "name": "找出挥拍", "seconds": 30, "label": "约 30 秒"},
        {"step": 4, "name": "整理数据", "seconds": 50, "label": "约 1 分钟"},
        {
            "step": 5,
            "name": "教练点评",
            "seconds": 150,
            "label": "约 2 分钟，这一步最慢",
        },
    ]
    cur = int(job.get("step") or 0)
    if job.get("status") in _TERMINAL:
        remain = 0
        hint = "已完成" if job.get("status") == "done" else ""
    else:
        remain = sum(s["seconds"] for s in steps if s["step"] >= max(cur, 1))
        mins = max(1, round(remain / 60))
        if cur >= 5:
            hint = f"正在生成报告，大约还要 2 分钟。关掉页面也没关系，回来还能接着看。"
        else:
            hint = f"全部大约还要 {mins} 分钟。关掉页面也不会中断，回来可继续查看进度。"
    return {"eta_steps": steps, "eta_remaining_s": remain, "eta_hint": hint}


def _write_status(job_id: str) -> None:
    job = _jobs[job_id]
    path = JOBS_DIR / job_id / "status.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(job, ensure_ascii=False, default=json_default), encoding="utf-8")


def _set(job_id: str, **kwargs) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        incoming = kwargs.get("status")
        if job.get("status") in _TERMINAL and incoming not in _TERMINAL:
            return
        job.update(kwargs)
        job["updated_at"] = _now()
        _write_status(job_id)


def _find_source_video(job_dir: Path) -> Path | None:
    for p in sorted(job_dir.glob("source.*")):
        if p.is_file() and p.stat().st_size > 1000:
            return p
    return None


def _load_status_file(job_dir: Path) -> dict | None:
    path = job_dir / "status.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _active_jobs_locked() -> list[dict]:
    return [job for job in _jobs.values() if job.get("status") in ("queued", "running")]


def _active_count() -> int:
    with _lock:
        return len(_active_jobs_locked())


def _at_capacity() -> bool:
    return _active_count() >= MAX_JOBS


def _busy_job() -> dict | None:
    """Prefer a running job for snapshots; else the oldest queued one."""
    with _lock:
        running = [j for j in _jobs.values() if j.get("status") == "running"]
        if running:
            return running[0]
        queued = [j for j in _jobs.values() if j.get("status") == "queued"]
        return queued[0] if queued else None


def _parse_job_ts(value: object) -> float | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value).timestamp()
    except ValueError:
        return None


def _busy_snapshot(job: dict | None = None) -> dict | None:
    """Public fields for health/409 so clients can show why submit is blocked."""
    current = job if job is not None else _busy_job()
    if current is None:
        return None
    eta = _eta_fields(current)
    return {
        "id": current.get("id"),
        "status": current.get("status"),
        "progress": current.get("progress"),
        "step": current.get("step"),
        "step_name": current.get("step_name"),
        "message": current.get("message"),
        "updated_at": current.get("updated_at") or current.get("created_at"),
        "eta_hint": eta.get("eta_hint"),
        "eta_remaining_s": eta.get("eta_remaining_s"),
    }


def _raise_busy() -> None:
    snap = _busy_snapshot()
    raise CodedHTTPException(
        409,
        "busy",
        "分析队列已满，请稍后再试",
        extra={
            "busy_job": snap,
            "active_jobs": _active_count(),
            "max_jobs": MAX_JOBS,
        }
        if snap
        else {"active_jobs": _active_count(), "max_jobs": MAX_JOBS},
    )


def _reap_stale_jobs() -> list[str]:
    """Mark zombie queued/running jobs as error so worker slots free."""
    if STALE_JOB_S <= 0:
        return []
    now = time.time()
    reaped: list[str] = []
    with _lock:
        for job_id, job in list(_jobs.items()):
            if job.get("status") not in ("queued", "running"):
                continue
            ts = _parse_job_ts(job.get("updated_at")) or _parse_job_ts(job.get("created_at"))
            if ts is None or (now - ts) < STALE_JOB_S:
                continue
            job["status"] = "error"
            job["message"] = "分析超时未完成，请重新提交"
            job["error"] = "stale_job"
            job["updated_at"] = _now()
            _write_status(job_id)
            reaped.append(job_id)
    return reaped


def _recover_jobs() -> None:
    """Reload jobs from disk. Finish ones that already have a report; drop the rest."""
    if not JOBS_DIR.is_dir():
        return
    sample = _sample_path()
    for job_dir in sorted(JOBS_DIR.iterdir()):
        if not job_dir.is_dir():
            continue
        job_id = job_dir.name
        job = _load_status_file(job_dir) or {"id": job_id}
        job["id"] = job_id
        report = job_dir / "report.json"
        video = job.get("video_path")
        if not video:
            if job.get("is_sample") and sample is not None:
                video = str(sample)
            else:
                src = _find_source_video(job_dir)
                video = str(src) if src else ""
        job["video_path"] = video
        status = job.get("status")
        if report.is_file() and status != "error":
            try:
                data = json.loads(report.read_text(encoding="utf-8"))
                overall = data.get("overall") or {}
                job["status"] = "done"
                job["step"] = 5
                job["step_name"] = "教练点评"
                job["progress"] = 100
                job["message"] = "分析完成"
                job["score"] = overall.get("score")
                job["n_swings"] = overall.get("n_swings")
            except Exception:
                pass
        elif status in ("queued", "running"):
            job["status"] = "cancelled"
            job["message"] = "分析已取消，请稍后再试"
        with _lock:
            _jobs[job_id] = job
            _write_status(job_id)
        if job.get("status") == "done":
            archive_report(job_dir, REPORTS_DIR)
            _save_progress(job_id)
        if job.get("is_sample") and job.get("status") == "done" and sample is not None:
            _save_sample_cache(
                job_id,
                sample,
                str(job.get("stroke_mode") or "forehand"),
                str(job.get("player_level") or DEFAULT_LEVEL),
            )


def _run_job(job_id: str) -> None:
    job = _jobs[job_id]
    out_dir = JOBS_DIR / job_id
    try:
        mode = str(job.get("analyze_mode") or "full")
        fast = mode == "fast"
        msg = "快速分析短片段…" if fast else "开始分析你的录像…"
        _set(job_id, status="running", step=1, step_name="读取视频", progress=1, message=msg)

        def progress(payload: dict) -> None:
            with _lock:
                if _jobs.get(job_id, {}).get("status") in _TERMINAL:
                    return
            patch = {k: v for k, v in payload.items() if k != "preview"}
            if payload.get("preview"):
                patch["preview_rev"] = datetime.now().timestamp()
            _set(job_id, status="running", **patch)

        report = analyze_video(
            Path(job["video_path"]),
            out_dir,
            max_seconds=float(job["max_seconds"]),
            stroke_mode=job["stroke_mode"],
            title=job.get("title") or "网球挥拍测评报告",
            player_level=job.get("player_level") or DEFAULT_LEVEL,
            progress=progress,
            fast=fast,
        )
        if report.get("analyze_mode"):
            with _lock:
                if job_id in _jobs:
                    _jobs[job_id]["analyze_mode"] = report.get("analyze_mode")
        _set(
            job_id,
            status="done",
            step=5,
            step_name="教练点评",
            progress=100,
            message="分析完成",
            score=report["overall"]["score"],
            n_swings=report["overall"]["n_swings"],
        )
        archive_report(out_dir, REPORTS_DIR)
        _save_progress(job_id)
        if job.get("is_sample"):
            src = _sample_path()
            if src is not None:
                _save_sample_cache(
                    job_id,
                    src,
                    str(job.get("stroke_mode") or "forehand"),
                    str(job.get("player_level") or DEFAULT_LEVEL),
                )
        digest = str(job.get("content_sha256") or "")
        if digest:
            _save_content_cache(
                job_id,
                digest,
                str(job.get("stroke_mode") or "forehand"),
                str(job.get("player_level") or DEFAULT_LEVEL),
                str(job.get("analyze_mode") or report.get("analyze_mode") or "full"),
            )
    except Exception as exc:
        user_msg = str(exc) if isinstance(exc, RuntimeError) else "分析失败，请稍后重试"
        _set(
            job_id,
            status="error",
            message=user_msg,
            error="".join(traceback.format_exception_only(type(exc), exc)).strip(),
        )


def _worker() -> None:
    get_estimator()
    get_detector()
    while True:
        job_id = _queue.get()
        try:
            _run_job(job_id)
        finally:
            _queue.task_done()


def _prepare_upload_meta(
    client: str,
    guide_completed: str,
    guide_checks: str,
    authorization: str | None,
) -> tuple[str, dict | None]:
    try:
        client_name = parse_client(client)
        claimed = parse_guide_flag(guide_completed)
        checks = parse_guide_checks(guide_checks)
    except GuideError as exc:
        raise CodedHTTPException(400, exc.code, str(exc)) from exc
    token = bearer_token(authorization)
    user = None
    if client_name in E1_CLIENTS:
        if not token:
            raise CodedHTTPException(401, "auth_required", "请先登录后再上传")
        user = verify_dev_token(token)
        if not user:
            raise CodedHTTPException(401, "auth_invalid", "登录已失效，请重新登录")
    elif token is not None:
        user = verify_dev_token(token) if token else None
        if not user:
            raise CodedHTTPException(401, "auth_invalid", "登录已失效，请重新登录")
    metadata = build_job_metadata(
        client=client_name,
        checks=checks,
        claimed=claimed,
        user=user,
    )
    return client_name, metadata


def _start_worker() -> None:
    global _worker_started
    if _worker_started:
        return
    _worker_started = True
    for i in range(WORKER_COUNT):
        threading.Thread(
            target=_worker,
            name=f"analyze-worker-{i}",
            daemon=True,
        ).start()
    threading.Thread(target=warm_agent, name="cursor-warm", daemon=True).start()
    _recover_jobs()


def _job_record(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is not None:
            return dict(job)
    data = _load_status_file(JOBS_DIR / job_id)
    return dict(data) if data else None


def _read_report(job_id: str) -> dict | None:
    path = JOBS_DIR / job_id / "report.json"
    if not path.is_file():
        archived = _archived_file(job_id, "report.json")
        path = archived if archived is not None else path
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _thumbnail_url(job_id: str) -> str | None:
    if not job_id or any(ch in job_id for ch in "/\\"):
        return None
    root = (JOBS_DIR / job_id).resolve()
    for name in ("preview.jpg", "cover.jpg"):
        target = (root / name).resolve()
        if target.parent == root and target.is_file():
            return f"/api/jobs/{job_id}/preview"
    if _archived_file(job_id, "preview.jpg", "cover.jpg") is not None:
        return f"/api/jobs/{job_id}/preview"
    return None


def _save_progress(job_id: str) -> None:
    job = _job_record(job_id)
    report = _read_report(job_id) if job else None
    if not job or not report:
        return
    entry = entry_from(job, report, _thumbnail_url(job_id))
    if entry is None:
        return
    try:
        upsert_entry(PROGRESS_DIR, entry)
    except (OSError, ValueError):
        print(f"[progress] save failed {job_id}", flush=True)


def _archived_file(job_id: str, *names: str) -> Path | None:
    arch = find_archive(REPORTS_DIR, job_id)
    if arch is None:
        return None
    root = arch.resolve()
    for name in names:
        target = (root / name).resolve()
        if root in target.parents and target.is_file():
            return target
    return None


app = FastAPI(title="网球挥拍测评 2.0")
app.add_exception_handler(CodedHTTPException, coded_handler)

@app.middleware("http")
async def analyze_busy_guard(request: Request, call_next):
    """Reject only when the multi-job queue is full — before multipart parse."""
    path = request.url.path.rstrip("/")
    if request.method == "POST" and path.endswith("/api/analyze"):
        _reap_stale_jobs()
        if _at_capacity():
            snap = _busy_snapshot()
            content = {
                "detail": "分析队列已满，请稍后再试",
                "code": "busy",
                "active_jobs": _active_count(),
                "max_jobs": MAX_JOBS,
            }
            if snap:
                content["busy_job"] = snap
            # Do not await request.body() — that forced a full phone upload into
            # a 409 (~2min). Client pingTai().busy fail-fasts when at capacity.
            return JSONResponse(
                status_code=409,
                content=content,
                headers={"Connection": "close"},
            )
    return await call_next(request)

if os.environ.get("TENNIS_AI_NO_WORKER") != "1":
    _start_worker()
else:
    _recover_jobs()


@app.get("/api/health")
def health():
    _reap_stale_jobs()
    sample = _sample_path()
    gpu = False
    try:
        import torch

        gpu = bool(torch.cuda.is_available())
    except Exception:
        gpu = False
    active = _active_count()
    at_cap = active >= MAX_JOBS
    snap = _busy_snapshot() if active else None
    return {
        "ok": True,
        "sample": bool(sample),
        "gpu": gpu,
        "version": "2.0",
        # busy=true only when the queue cannot accept another job (Next fail-fast).
        "busy": at_cap,
        "busy_job": snap if at_cap else None,
        "active_jobs": active,
        "max_jobs": MAX_JOBS,
        "workers": WORKER_COUNT,
        "levels": public_levels(),
        "default_level": DEFAULT_LEVEL,
    }


@app.get("/api/levels")
def levels():
    return {"items": public_levels(), "default": DEFAULT_LEVEL}


@app.post("/api/auth/mock")
async def auth_mock(request: Request):
    """开发态 code→token。正式微信登录是后续 ticket，这里不访问微信服务器。"""
    try:
        body = await request.json()
    except Exception as exc:
        raise CodedHTTPException(400, "login_body_invalid", "登录请求无法识别") from exc
    if not isinstance(body, dict):
        raise CodedHTTPException(400, "login_body_invalid", "登录请求无法识别")
    code = str(body.get("code") or "").strip()
    if not 4 <= len(code) <= 128:
        raise CodedHTTPException(400, "login_code_invalid", "登录码无效，请重试")
    return issue_dev_token(code)


@app.get("/api/auth/me")
def auth_me(authorization: str | None = Header(default=None)):
    token = bearer_token(authorization)
    user = verify_dev_token(token) if token else None
    if not user:
        raise CodedHTTPException(401, "auth_invalid", "登录已失效，请重新登录")
    return {"user": {"id": user["sub"]}, "login_mode": "dev-mock"}


@app.get("/e1")
def e1_page():
    return FileResponse(STATIC_DIR / "e1.html")


@app.get("/e1/{name}")
def e1_asset(name: str):
    media = E1_ASSETS.get(name)
    path = STATIC_DIR / name
    if media is None or not path.is_file():
        raise HTTPException(404, "文件不存在")
    return FileResponse(path, media_type=media)


@app.get("/i18n/{lang}.json")
def i18n_catalog(lang: str):
    if lang not in {"zh-CN", "en"}:
        raise HTTPException(404, "不支持的语言")
    path = I18N_DIR / f"{lang}.json"
    if not path.is_file():
        raise HTTPException(404, "不支持的语言")
    return FileResponse(path, media_type="application/json")


@app.get("/api/sample")
def sample_info():
    path = _sample_path()
    if not path:
        raise HTTPException(404, "服务器上还没有样例视频")
    return {
        "name": path.name,
        "label": "1 分钟侧面训练样例",
        "exists": True,
    }


@app.post("/api/analyze")
async def analyze(
    video: UploadFile | None = File(default=None),
    sample: str = Form(default="0"),
    refresh: str = Form(default="0"),
    max_seconds: float = Form(default=0),
    stroke: str = Form(default="forehand"),
    title: str = Form(default="网球挥拍测评报告 2.0"),
    level: str = Form(default=DEFAULT_LEVEL),
    client: str = Form(default=""),
    guide_completed: str = Form(default=""),
    guide_checks: str = Form(default=""),
    fast: str = Form(default=""),
    authorization: str | None = Header(default=None),
):
    if stroke not in ("auto", "forehand", "backhand", "serve"):
        stroke = "forehand"
    stroke = normalize_stroke(stroke, default="forehand")
    player_level = parse_level(level).code
    _client_name, metadata = _prepare_upload_meta(
        client, guide_completed, guide_checks, authorization
    )

    use_sample = sample in ("1", "true", "yes")
    force_refresh = refresh in ("1", "true", "yes")
    src = _sample_path() if use_sample else None
    if use_sample:
        if src is None:
            raise HTTPException(400, "没有可用的样例视频")
        cache = None if force_refresh else _load_sample_cache(src, stroke, player_level)
        if cache is not None:
            job_id = uuid.uuid4().hex[:12]
            meta = _install_sample_cache(job_id, cache)
            now = _now()
            with _lock:
                _jobs[job_id] = {
                    "id": job_id,
                    "status": "done",
                    "step": 5,
                    "step_name": "教练点评",
                    "progress": 100,
                    "message": "分析完成",
                    "max_seconds": 60,
                    "stroke_mode": stroke,
                    "player_level": player_level,
                    "title": title,
                    "source_name": meta.get("source_name") or src.name,
                    "score": meta.get("score"),
                    "n_swings": meta.get("n_swings"),
                    "cached": True,
                    "is_sample": True,
                    "created_at": now,
                    "updated_at": now,
                }
                _write_status(job_id)
            if metadata:
                with _lock:
                    _jobs[job_id]["metadata"] = metadata
                    _write_status(job_id)
            archive_report(JOBS_DIR / job_id, REPORTS_DIR)
            _save_progress(job_id)
            return {"job_id": job_id, "cached": True}

    _reap_stale_jobs()
    if _at_capacity():
        _raise_busy()

    if use_sample and force_refresh and src is not None:
        _clear_sample_cache(src, stroke, player_level)

    job_id = uuid.uuid4().hex[:12]
    out_dir = JOBS_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    want_fast = _truthy(fast)
    content_sha = ""
    analyze_mode = "full"
    if use_sample:
        video_path = src
        source_name = src.name
        analyze_mode = "fast" if want_fast else "full"
        max_seconds = FAST_MAX_SECONDS if want_fast else 60
    else:
        if video is None or not video.filename:
            shutil.rmtree(out_dir, ignore_errors=True)
            raise CodedHTTPException(400, "video_required", "请上传视频，或选择使用样例")
        suffix = Path(video.filename).suffix.lower()
        data = await video.read()
        rejection = video_rejection(suffix, len(data))
        if rejection is not None:
            shutil.rmtree(out_dir, ignore_errors=True)
            code, message = rejection
            raise CodedHTTPException(400, code, message)
        content_sha = hashlib.sha256(data).hexdigest()
        video_path = out_dir / f"source{suffix}"
        video_path.write_bytes(data)
        source_name = Path(video.filename).name
        duration = _video_duration_s(video_path)
        if want_fast or (duration > 0 and duration <= AUTO_FAST_MAX_SECONDS):
            analyze_mode = "fast"
            max_seconds = FAST_MAX_SECONDS if (not max_seconds or max_seconds <= 0) else min(
                float(max_seconds), FAST_MAX_SECONDS
            )
        else:
            max_seconds = float(max_seconds or 0)

        if not force_refresh and content_sha:
            cache = _load_content_cache(content_sha, stroke, player_level, analyze_mode)
            if cache is not None:
                meta = _install_report_cache(job_id, cache)
                now = _now()
                mode = str(meta.get("analyze_mode") or analyze_mode)
                with _lock:
                    _jobs[job_id] = {
                        "id": job_id,
                        "status": "done",
                        "step": 5,
                        "step_name": "教练点评",
                        "progress": 100,
                        "message": "分析完成",
                        "max_seconds": max_seconds or FAST_MAX_SECONDS,
                        "stroke_mode": stroke,
                        "player_level": player_level,
                        "title": title,
                        "source_name": source_name,
                        "score": meta.get("score"),
                        "n_swings": meta.get("n_swings"),
                        "cached": True,
                        "is_sample": False,
                        "analyze_mode": mode,
                        "created_at": now,
                        "updated_at": now,
                    }
                    if metadata:
                        _jobs[job_id]["metadata"] = metadata
                    _write_status(job_id)
                archive_report(JOBS_DIR / job_id, REPORTS_DIR)
                _save_progress(job_id)
                out = {
                    "job_id": job_id,
                    "cached": True,
                    "queued": False,
                    "analyze_mode": mode,
                    "fast": mode == "fast",
                }
                if isinstance(meta.get("report"), dict):
                    out["report"] = meta["report"]
                    out["status"] = "done"
                    out["progress"] = 100
                    out["score"] = meta.get("score")
                return out

    with _lock:
        active = _active_jobs_locked()
        if len(active) >= MAX_JOBS:
            shutil.rmtree(out_dir, ignore_errors=True)
            snap = _busy_snapshot(active[0])
            raise CodedHTTPException(
                409,
                "busy",
                "分析队列已满，请稍后再试",
                extra={
                    "busy_job": snap,
                    "active_jobs": len(active),
                    "max_jobs": MAX_JOBS,
                },
            )
        record = {
            "id": job_id,
            "status": "queued",
            "step": 0,
            "step_name": "准备中",
            "progress": 0,
            "message": "快速分析…" if analyze_mode == "fast" else "开始分析…",
            "max_seconds": max_seconds,
            "stroke_mode": stroke,
            "player_level": player_level,
            "title": title,
            "source_name": source_name,
            "video_path": str(video_path),
            "is_sample": use_sample,
            "analyze_mode": analyze_mode,
            "content_sha256": content_sha,
            "created_at": _now(),
        }
        if metadata:
            record["metadata"] = metadata
        _jobs[job_id] = record
        _write_status(job_id)

    _queue.put(job_id)
    return {
        "job_id": job_id,
        "cached": False,
        "queued": True,
        "analyze_mode": analyze_mode,
        "fast": analyze_mode == "fast",
    }


@app.get("/api/history")
def history():
    items = list_history(JOBS_DIR, REPORTS_DIR)
    for item in items:
        job_dir = JOBS_DIR / item["id"]
        if job_dir.is_dir():
            archive_report(job_dir, REPORTS_DIR, item)
    return {
        "items": items,
        "dir": str(REPORTS_DIR),
        "count": len(items),
    }


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    with _lock:
        job = _jobs.get(job_id)
        if job is not None:
            return _public_job(job)
    status_file = JOBS_DIR / job_id / "status.json"
    if status_file.exists():
        data = json.loads(status_file.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return _public_job(data)
        return data
    raise HTTPException(404, "任务不存在")


@app.get("/api/jobs/{job_id}/result")
def job_result(job_id: str, authorization: str | None = Header(default=None)):
    job = _job_record(job_id)
    if job is None:
        raise CodedHTTPException(404, "result_missing", "找不到这次任务")
    report = _read_report(job_id)
    if report is None:
        status = str(job.get("status") or "")
        if status in ("error", "cancelled"):
            raise CodedHTTPException(409, "result_unavailable", "这次分析没有完成")
        raise CodedHTTPException(409, "result_pending", "结果还在生成")
    owner = user_id_of(job)
    token = bearer_token(authorization)
    viewer = verify_dev_token(token) if token else None
    viewer_id = str(viewer.get("sub")) if viewer and viewer.get("sub") else ""
    stroke = stroke_of(job, report)
    timeline: list[dict] = []
    if not owner:
        reason = "no_user"
    elif viewer_id == owner:
        _save_progress(job_id)
        try:
            timeline = list_entries(PROGRESS_DIR, owner, stroke)
        except OSError:
            timeline = []
        reason = "" if len(timeline) >= 2 else "need_two"
    elif viewer_id:
        reason = "not_owner"
    else:
        reason = "sign_in"
    return assemble_result(
        job,
        report,
        timeline=timeline,
        reason=reason,
        thumbnail=_thumbnail_url(job_id),
    )


@app.get("/api/jobs/{job_id}/preview")
def job_preview(job_id: str):
    root = (JOBS_DIR / job_id).resolve()
    for name in ("preview.jpg", "cover.jpg"):
        target = (root / name).resolve()
        if target.parent != root or not target.is_file():
            continue
        return FileResponse(
            target,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-store"},
        )
    archived = _archived_file(job_id, "preview.jpg", "cover.jpg")
    if archived is not None:
        return FileResponse(
            archived,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-store"},
        )
    raise HTTPException(404, "预览尚未生成")


@app.get("/api/jobs/{job_id}/report")
def job_report(job_id: str):
    path = JOBS_DIR / job_id / "report.json"
    if not path.exists():
        archived = _archived_file(job_id, "report.json")
        path = archived if archived is not None else path
    if not path.exists():
        raise HTTPException(404, "报告尚未生成")
    data = json.loads(path.read_text(encoding="utf-8"))
    return JSONResponse(refresh_report_urls(data))


@app.get("/jobs/{job_id}/{path:path}")
def job_file(job_id: str, path: str):
    root = (JOBS_DIR / job_id).resolve()
    target = (root / path).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(400, "非法路径")
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "文件不存在")
    return FileResponse(target)


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
