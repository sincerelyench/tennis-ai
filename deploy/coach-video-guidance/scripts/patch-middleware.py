#!/usr/bin/env python3
"""Ensure /tennis/coach-video-guidance.html is public (preview). Idempotent."""
from __future__ import annotations

import sys
from pathlib import Path

MARKER = "coach-video-guidance.html"


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/tennis-ai")
    mw = root / "middleware.ts"
    if not mw.is_file():
        print(f"skip: no {mw}")
        return 0
    text = mw.read_text(encoding="utf-8")
    if MARKER in text:
        print("middleware already allows coach-video-guidance preview")
        return 0

    needle = "coach-eight-techniques.html"
    if needle in text:
        text = text.replace(needle, f"{needle}\",\n  \"/{MARKER}", 1)
        # fix accidental double — keep simple alternate insert below if broken
        mw.write_text(text, encoding="utf-8")
        print("patched middleware via eight-techniques neighbor")
        return 0

    # Fallback: insert into a common PUBLIC / publicPaths array literal.
    for key in ('const PUBLIC = [', "const publicPaths = [", "const PUBLIC_PATHS = ["):
        idx = text.find(key)
        if idx < 0:
            continue
        insert_at = text.find("[", idx) + 1
        addition = f'\n  "/{MARKER}",'
        text = text[:insert_at] + addition + text[insert_at:]
        mw.write_text(text, encoding="utf-8")
        print(f"patched middleware ({key.strip()})")
        return 0

    print("warn: could not patch middleware automatically")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
