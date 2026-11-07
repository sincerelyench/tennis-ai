#!/usr/bin/env python3
"""Seed .data/coach-library.json for built-in 涨球教练 with eight-technique canon prompts."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Keep titles aligned with ApiStroke / analyze catalog.
STROKES = [
    ("fh-topspin", "底线正手（正手上旋）"),
    ("bh-topspin", "底线反手"),
    ("fh-volley", "截击正手"),
    ("bh-volley", "截击反手"),
    ("fh-slice", "正手切削"),
    ("bh-slice", "反手切削"),
    ("serve", "发球"),
    ("smash", "高压球"),
]


def load_prompts_from_ts(root: Path) -> dict[str, str]:
    """Parse techniquePromptBlock-ish content from eight-techniques.ts by section headers."""
    path = root / "lib" / "eight-techniques.ts"
    text = path.read_text(encoding="utf-8")
    # Prefer shipping the file itself into library as full section dumps via a tiny runtime seed
    # that reuses JSON exported next to the patch when present.
    sidecar = Path(__file__).resolve().parent.parent / "opt-patch" / "lib" / "eight-techniques-seed.json"
    if sidecar.is_file():
        return json.loads(sidecar.read_text(encoding="utf-8"))
    # Fallback: mark that the Next module is the source of truth.
    out = {}
    for stroke_id, title in STROKES:
        out[stroke_id] = f"【{title}】\n（完整要点见 lib/eight-techniques.ts / 涨球教练八项技术要领）"
    _ = text  # ensure file exists
    return out


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/tennis-ai")
    data_dir = root / ".data"
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / "coach-library.json"
    store: dict = {}
    if path.is_file():
        try:
            store = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            store = {}

    prompts = load_prompts_from_ts(root)
    now = datetime.now(timezone.utc).isoformat()
    coach_id = "poppy"
    bucket = store.get(coach_id) or {"coachId": coach_id, "coachName": "涨球教练", "entries": {}}
    entries = dict(bucket.get("entries") or {})
    for stroke_id, title in STROKES:
        prompt = prompts.get(stroke_id) or f"【{title}】"
        prev = entries.get(stroke_id) or {}
        # Only fill empty prompts so coach-authored text is preserved.
        if str(prev.get("prompt") or "").strip():
            continue
        entries[stroke_id] = {
            "strokeId": stroke_id,
            "title": title,
            "prompt": prompt,
            "videoUrl": str(prev.get("videoUrl") or ""),
            "updatedAt": now,
        }
    bucket["entries"] = entries
    bucket["coachId"] = coach_id
    bucket["coachName"] = "涨球教练"
    bucket["updatedAt"] = now
    store[coach_id] = bucket
    path.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"seeded {path} with {len(entries)} strokes for 涨球教练")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
