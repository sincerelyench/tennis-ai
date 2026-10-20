"""Same-user progress timeline and the four-axis result payload.

Storage is one JSON file per user under outputs/progress. A point is written
only after a finished report has all four scores. Comparison stays closed
until that user has two finished analyses of the same stroke.
"""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path

from pipeline.analyze import SCORE_AXES, grade_from_score

_LOCK = threading.Lock()
_USER_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
_JOB_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
_STROKES = (
    "forehand",
    "backhand",
    "serve",
    "fh-topspin",
    "fh-slice",
    "bh-topspin",
    "bh-slice",
    "fh-volley",
    "bh-volley",
    "smash",
)
_UNSAFE = ("医疗", "治伤", "伤病", "诊断", "保证涨分", "实验室级")

# key, Chinese axis name, keywords that tie an existing drill to that axis.
_AXIS_META = (
    ("balance", "重心", ("重心", "屈膝", "膝盖", "站得", "头肩")),
    ("contact", "击球点", ("击球点", "身前", "胸口")),
    ("chain", "动力链", ("动力链", "转体", "转髋", "转肩", "引拍", "发力顺序")),
    ("effect", "击球效果", ("击球效果", "上旋", "随挥", "拍面", "轨迹", "挥拍", "由低到高")),
)
_MAX = {name: int(cap) for name, cap in SCORE_AXES}

# Used only when the analysis report has no safe, matching practice line.
FALLBACK_TIPS = {
    "重心": "准备时屈膝，把重心放低并稳住。连续打 10 个球，每球停一下，看膝盖是否保持弯曲。",
    "击球点": "先把击球点放在身前、大约胸口高度。慢速打 10 个球，位置固定后再加快。",
    "动力链": "先转髋和肩膀，手臂再跟上。对镜慢动作做 8 次，确认身体先动、球拍后到。",
    "击球效果": "挥拍从低到高，随挥收到肩前。用 10 个球看球是不是向前上方飞出。",
}


def _safe(text: str) -> bool:
    return not any(word in text for word in _UNSAFE)


def _clean_line(value) -> str:
    if not isinstance(value, str):
        return ""
    text = " ".join(value.split()).strip()
    if not text or not _safe(text):
        return ""
    if len(text) > 400:
        text = text[:399].rstrip() + "…"
    return text


def _collect(report: dict, key: str) -> list[str]:
    found: list[str] = []

    def push(value) -> None:
        if isinstance(value, str):
            line = _clean_line(value)
            if line and line not in found:
                found.append(line)
        elif isinstance(value, list):
            for item in value:
                push(item)

    push(report.get(key))
    coach = report.get("coach") if isinstance(report.get("coach"), dict) else {}
    push(coach.get(key))
    for clip in report.get("clips") or []:
        if not isinstance(clip, dict):
            continue
        analysis = clip.get("analysis") if isinstance(clip.get("analysis"), dict) else {}
        push(analysis.get(key))
    return found


def _pick(lines: list[str], hints: tuple[str, ...], used: set[int]) -> str:
    for index, line in enumerate(lines):
        if index in used:
            continue
        if any(hint in line for hint in hints):
            used.add(index)
            return line
    return ""


def _clamp(value, cap: int) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return max(0, min(int(cap), int(round(float(value)))))


def _raw_scores(report: dict) -> dict[str, int | None]:
    overall = report.get("overall") if isinstance(report.get("overall"), dict) else {}
    block = overall.get("scores") if isinstance(overall.get("scores"), dict) else {}
    clip_values: dict[str, list[float]] = {name: [] for name, _cap in SCORE_AXES}
    for clip in report.get("clips") or []:
        if not isinstance(clip, dict):
            continue
        scores = clip.get("scores") if isinstance(clip.get("scores"), dict) else {}
        for name, _cap in SCORE_AXES:
            raw = scores.get(name)
            if isinstance(raw, (int, float)) and not isinstance(raw, bool):
                clip_values[name].append(float(raw))
    out: dict[str, int | None] = {}
    for name, cap in SCORE_AXES:
        value = _clamp(block.get(name), cap)
        if value is None and clip_values[name]:
            value = _clamp(sum(clip_values[name]) / len(clip_values[name]), cap)
        out[name] = value
    return out


def _as_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def stroke_of(job: dict, report: dict | None = None) -> str:
    """User-selected stroke wins. auto falls back to the larger shot mix."""
    raw = str((job or {}).get("stroke_mode") or (report or {}).get("stroke_mode") or "").strip().lower()
    if raw in _STROKES:
        return raw
    mix = {}
    if isinstance(report, dict):
        overall = report.get("overall") if isinstance(report.get("overall"), dict) else {}
        if isinstance(overall.get("shot_mix"), dict):
            mix = overall["shot_mix"]
    if _as_int(mix.get("backhand")) > _as_int(mix.get("forehand")):
        return "backhand"
    return "forehand"


def contact_t(report: dict) -> float | None:
    for clip in report.get("clips") or []:
        if not isinstance(clip, dict):
            continue
        for swing in clip.get("swings") or []:
            if not isinstance(swing, dict):
                continue
            raw = swing.get("contact_t")
            if isinstance(raw, (int, float)) and not isinstance(raw, bool):
                return round(float(raw), 2)
    for row in report.get("timeline") or []:
        if not isinstance(row, dict):
            continue
        raw = row.get("t")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            return round(float(raw), 2)
    return None


def _actionable(line: str) -> bool:
    return any(token in line for token in ("训练", "→", "次", "组", "打", "做", "先", "屈", "慢速"))


def axis_tips(report: dict) -> dict[str, str]:
    drills: list[str] = []
    for line in _collect(report, "drills") + _collect(report, "improvements"):
        if line not in drills:
            drills.append(line)
    problems = _collect(report, "problems")
    used_drills: set[int] = set()
    used_problems: set[int] = set()
    tips: dict[str, str] = {}
    for _key, name, hints in _AXIS_META:
        picked = _pick(drills, hints, used_drills) or _pick(problems, hints, used_problems)
        tips[name] = picked if picked and _actionable(picked) else FALLBACK_TIPS[name]
    return tips


def focus_line(report: dict) -> str:
    return _clean_line(report.get("focus")) or _clean_line(
        (report.get("coach") or {}).get("focus") if isinstance(report.get("coach"), dict) else ""
    )


def guide_flag(job: dict) -> bool | None:
    meta = job.get("metadata") if isinstance(job.get("metadata"), dict) else {}
    flag = meta.get("guide_completed")
    if isinstance(flag, bool):
        return flag
    return None


def user_id_of(job: dict) -> str:
    meta = job.get("metadata") if isinstance(job.get("metadata"), dict) else {}
    raw = meta.get("user_id")
    if not isinstance(raw, str) or not _USER_ID.match(raw):
        return ""
    return raw


def entry_from(job: dict, report: dict, thumbnail: str | None) -> dict | None:
    """One timeline point. None when the job is anonymous or scores are incomplete."""
    user_id = user_id_of(job)
    job_id = str((job or {}).get("id") or "")
    if not user_id or not _JOB_ID.match(job_id) or not isinstance(report, dict):
        return None
    scores = _raw_scores(report)
    if any(scores.get(name) is None for name, _cap in SCORE_AXES):
        return None
    created = str(job.get("created_at") or report.get("generated_at") or "")
    thumb = thumbnail if isinstance(thumbnail, str) and thumbnail.startswith("/api/jobs/") else None
    return {
        "user_id": user_id,
        "stroke": stroke_of(job, report),
        "job_id": job_id,
        "scores": {name: int(scores[name]) for name, _cap in SCORE_AXES},
        "thumbnail": thumb,
        "contact_t": contact_t(report),
        "created_at": created,
    }


def _path(store: Path, user_id: str) -> Path:
    if not _USER_ID.match(user_id):
        raise ValueError("user_id")
    return store / f"{user_id}.json"


def _load_items(path: Path) -> list[dict] | None:
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return None
    return [item for item in data["items"] if isinstance(item, dict)]


def _sort_key(item: dict) -> tuple[str, str]:
    return (str(item.get("created_at") or ""), str(item.get("job_id") or ""))


def list_entries(store: Path, user_id: str, stroke: str = "") -> list[dict]:
    if not _USER_ID.match(user_id or ""):
        return []
    with _LOCK:
        items = _load_items(_path(store, user_id))
    if not items:
        return []
    if stroke:
        items = [item for item in items if item.get("stroke") == stroke]
    items.sort(key=_sort_key)
    return items


def upsert_entry(store: Path, entry: dict) -> None:
    user_id = str(entry.get("user_id") or "")
    job_id = str(entry.get("job_id") or "")
    if not _USER_ID.match(user_id) or not _JOB_ID.match(job_id):
        raise ValueError("progress entry")
    path = _path(store, user_id)
    with _LOCK:
        current = _load_items(path)
        if current is None:
            raise OSError("progress file unreadable")
        items = [item for item in current if item.get("job_id") != job_id]
        items.append(entry)
        items.sort(key=_sort_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(
            json.dumps({"user_id": user_id, "items": items}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp.replace(path)


def _public_scores(scores: dict) -> dict[str, int]:
    out: dict[str, int] = {}
    for key, name, _hints in _AXIS_META:
        value = _clamp((scores or {}).get(name), _MAX[name])
        if value is None:
            continue
        out[key] = value
    return out


def _public_item(entry: dict, current_job: str) -> dict:
    return {
        "job_id": entry.get("job_id"),
        "stroke": entry.get("stroke"),
        "created_at": entry.get("created_at") or "",
        "scores": _public_scores(entry.get("scores") or {}),
        "thumbnail": entry.get("thumbnail"),
        "contact_t": entry.get("contact_t"),
        "current": entry.get("job_id") == current_job,
    }


def _comparison(items: list[dict], current_job: str) -> dict | None:
    if len(items) < 2:
        return None
    earlier = _public_scores(items[0].get("scores") or {})
    later = _public_scores(items[-1].get("scores") or {})
    if set(earlier) != {key for key, _name, _hints in _AXIS_META}:
        return None
    if set(later) != set(earlier):
        return None
    return {
        "earlier": _public_item(items[0], current_job),
        "later": _public_item(items[-1], current_job),
        "deltas": {key: later[key] - earlier[key] for key in earlier},
    }


def assemble_result(
    job: dict,
    report: dict,
    *,
    timeline: list[dict],
    reason: str,
    thumbnail: str | None,
) -> dict:
    scores = _raw_scores(report)
    tips = axis_tips(report)
    axes = []
    complete = True
    for key, name, _hints in _AXIS_META:
        value = scores.get(name)
        if value is None:
            complete = False
        axes.append(
            {
                "key": key,
                "score": value,
                "max": _MAX[name],
                "tip": tips[name],
            }
        )
    total = sum(int(item["score"]) for item in axes) if complete else None
    grade = grade_from_score(int(total))[0] if total is not None else None
    flag = guide_flag(job)
    current_job = str(job.get("id") or "")
    items = [_public_item(item, current_job) for item in timeline]
    compared = _comparison(timeline, current_job) if reason == "" else None
    ready = compared is not None
    return {
        "job_id": job.get("id"),
        "stroke": stroke_of(job, report),
        "created_at": str(job.get("created_at") or report.get("generated_at") or ""),
        "guide_completed": flag,
        "guide_warning": flag is False,
        "total": total,
        "grade": grade,
        "focus": focus_line(report),
        "thumbnail": thumbnail if isinstance(thumbnail, str) else None,
        "contact_t": contact_t(report),
        "axes": axes,
        "progress": {
            "count": len(timeline) if reason in ("", "need_two") else 0,
            "compare_ready": ready,
            "reason": "" if ready else (reason or "need_two"),
            "items": items,
            "comparison": compared,
        },
    }
