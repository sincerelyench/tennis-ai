#!/usr/bin/env python3
"""Patch web/app.py on GPU host to call normalize_stroke."""
from __future__ import annotations
import re, sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
app = root / "web" / "app.py"
text = app.read_text(encoding="utf-8")
if "normalize_stroke" not in text:
    text = text.replace(
        "from pipeline.session import analyze_video, get_detector, get_estimator, json_default\n",
        "from pipeline.session import analyze_video, get_detector, get_estimator, json_default\n"
        "from pipeline.stroke import normalize_stroke\n",
        1,
    )
old = re.search(
    r'if stroke not in \("auto", "forehand", "backhand"(?:, "serve")?\):\n\s+stroke = "forehand"\n',
    text,
)
if old:
    text = text[: old.start()] + '    stroke = normalize_stroke(stroke, default="forehand")\n' + text[old.end() :]
elif "normalize_stroke(stroke" not in text:
    raise SystemExit("could not find stroke allowlist block to patch")
app.write_text(text, encoding="utf-8")
print("patched", app)
