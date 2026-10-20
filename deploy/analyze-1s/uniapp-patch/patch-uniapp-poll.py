#!/usr/bin/env python3
"""Best-effort: speed up analyze polling + pass fast=1 for short clips in uni-app src."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
changed: list[str] = []


def write(path: Path, text: str, orig: str) -> None:
    if text == orig:
        return
    path.write_text(text, encoding="utf-8")
    changed.append(str(path))


def patch_poll_ms(text: str) -> str:
    # Prefer named constant if present.
    if "ANALYZE_POLL_MS" in text and "250" in text:
        return text
    # setInterval/setTimeout used for job polling
    text2 = re.sub(
        r"(set(?:Interval|Timeout)\(\s*[^,]+,\s*)(2000|1500|1000|800)(\s*\))",
        r"\g<1>250\3",
        text,
    )
    # sleep(2000) style in async loops near /api/jobs
    if "/api/jobs" in text or "job_id" in text or "analyze" in text.lower():
        text2 = re.sub(r"\b(2000|1500)\b", "250", text2)
    return text2


def patch_fast_form(text: str) -> str:
    if "fast" in text and "duration" in text:
        return text
    # FormData.append("sample"…) nearby — inject fast for short clips once.
    marker = 'append("sample"'
    if marker not in text and "formData.sample" not in text and 'sample:' not in text:
        return text
    if 'append("fast"' in text or "formData.fast" in text:
        return text
    inject = (
        '\n    if (typeof duration === "number" && duration > 0 && duration <= 6) {\n'
        '      fd.append("fast", "1");\n'
        "    }\n"
    )
    # After FormData construction common patterns
    for pat in (
        r'(const fd = new FormData\(\);\n)',
        r'(const formData = new FormData\(\);\n)',
    ):
        if re.search(pat, text):
            return re.sub(pat, r"\1" + inject.replace("fd.", "fd." if "fd =" in text else "formData."), text, count=1)
    return text


for path in list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.tsx")) + list(ROOT.rglob("*.vue")) + list(
    ROOT.rglob("*.js")
):
    if "node_modules" in path.parts or "dist" in path.parts:
        continue
    rel = str(path.relative_to(ROOT))
    if not any(
        key in rel
        for key in (
            "analysis",
            "analyze",
            "job-progress",
            "pages/analysis",
            "lib/job",
            "api/analyze",
        )
    ):
        continue
    orig = path.read_text(encoding="utf-8", errors="ignore")
    text = patch_poll_ms(orig)
    text = patch_fast_form(text)
    write(path, text, orig)

print("patched", len(changed), "files")
for c in changed[:40]:
    print(" ", c)
if not changed:
    print("WARN: no files patched — apply manually per uniapp-patch/README.md")
    sys.exit(0)
