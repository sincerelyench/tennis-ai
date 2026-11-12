"""Normalize product stroke / technique ids for analyze jobs.

Clients (涨球 web / uni-app / Android) send fine-grained ids such as
``fh-topspin`` or ``serve``. The job stores that canonical id as
``stroke_mode``; biomechanics still map onto forehand / backhand families.
"""

from __future__ import annotations

# Product catalog (apiStroke) — keep 1:1 with the app strokeTypes list.
PRODUCT_STROKES = (
    "fh-topspin",
    "fh-slice",
    "bh-topspin",
    "bh-slice",
    "serve",
    "fh-volley",
    "bh-volley",
    "smash",
)

# Legacy API values still accepted.
LEGACY_STROKES = ("auto", "forehand", "backhand", "serve")

_ALIASES = {
    "auto": "auto",
    "forehand": "forehand",
    "backhand": "backhand",
    "serve": "serve",
    "发球": "serve",
    "一发": "serve",
    "二发": "serve",
    "正手": "fh-topspin",
    "正手上旋": "fh-topspin",
    "正手切削": "fh-slice",
    "反手": "bh-topspin",
    "反手上旋": "bh-topspin",
    "反手切削": "bh-slice",
    "正手截击": "fh-volley",
    "反手截击": "bh-volley",
    "高压": "smash",
    "高压球": "smash",
    "overhead": "smash",
    "topspin": "fh-topspin",
    "slice": "fh-slice",
    "volley": "fh-volley",
}

for _id in PRODUCT_STROKES:
    _ALIASES[_id] = _id
    _ALIASES[_id.lower()] = _id

_LABELS = {
    "auto": "自动识别",
    "forehand": "正手",
    "backhand": "反手",
    "fh-topspin": "正手上旋",
    "fh-slice": "正手切削",
    "bh-topspin": "反手上旋",
    "bh-slice": "反手切削",
    "serve": "发球",
    "fh-volley": "正手截击",
    "bh-volley": "反手截击",
    "smash": "高压球",
}

# Biomechanics family used inside session.measure / score_and_write.
_FAMILY = {
    "auto": "auto",
    "forehand": "forehand",
    "fh-topspin": "forehand",
    "fh-slice": "forehand",
    "fh-volley": "forehand",
    "serve": "forehand",
    "smash": "forehand",
    "backhand": "backhand",
    "bh-topspin": "backhand",
    "bh-slice": "backhand",
    "bh-volley": "backhand",
}


def normalize_stroke(raw: str | None, default: str = "forehand") -> str:
    """Map free-form client values onto a canonical stroke id.

    Unknown values fall back to ``default`` (forehand) so old clients keep
    working, but every product catalog id and common Chinese alias is kept.
    """
    text = str(raw or "").strip()
    if not text:
        return default
    key = text.lower() if text.isascii() else text
    if text in _ALIASES:
        return _ALIASES[text]
    if key in _ALIASES:
        return _ALIASES[key]
    # Tolerate Serve / FOREHAND style casing for ascii ids.
    if key in PRODUCT_STROKES or key in LEGACY_STROKES:
        return key
    return default


def stroke_label(stroke: str) -> str:
    return _LABELS.get(stroke, _LABELS.get(normalize_stroke(stroke), stroke or "正手"))


def measure_family(stroke: str) -> str:
    """Return ``forehand``, ``backhand``, or ``auto`` for peak labeling."""
    canon = normalize_stroke(stroke)
    return _FAMILY.get(canon, "forehand")


def clip_id_for(stroke: str, measured: str) -> str:
    """Clip id shown in reports: prefer declared product stroke over measured."""
    canon = normalize_stroke(stroke)
    if canon in ("auto", "forehand", "backhand"):
        return measured if measured in ("forehand", "backhand") else canon
    return canon


def is_overhead(stroke: str) -> bool:
    return normalize_stroke(stroke) in ("serve", "smash")
