#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from shutil import copy2

p = Path("/opt/tennis-ai/middleware.ts")
text = p.read_text(encoding="utf-8")
changed = False

if "coach-eight-techniques" not in text:
    text = text.replace(
        'if (p.includes("network-coach-chat")) return NextResponse.next();',
        'if (p.includes("network-coach-chat")) return NextResponse.next();\n'
        '  if (p.includes("coach-eight-techniques")) return NextResponse.next();',
    )
    changed = True

if '"/coach-eight-techniques.html"' not in text:
    text = text.replace(
        '"/report-four-dim-preview.html",',
        '"/report-four-dim-preview.html",\n  "/coach-eight-techniques.html",',
    )
    changed = True

if "coach-eight-techniques\\.html" not in text:
    text = text.replace(
        "report-four-dim-preview\\.html",
        "report-four-dim-preview\\.html|coach-eight-techniques\\.html",
    )
    changed = True

if changed:
    p.write_text(text, encoding="utf-8")
    print("middleware updated")
else:
    print("middleware already ok")

src = Path("/opt/tennis-ai/public/coach-eight-techniques.html")
for dest in (
    Path("/var/www/html/coach-eight-techniques.html"),
    Path("/var/www/apk/coach-eight-techniques.html"),
):
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        copy2(src, dest)
        print("copied", dest)
    except Exception as exc:  # noqa: BLE001
        print("skip", dest, exc)
