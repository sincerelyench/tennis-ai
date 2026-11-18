#!/usr/bin/env python3
"""
Surgical inject of mp-subscribe-client calls into live friends-view.tsx.
Does NOT replace the whole file (avoids wiping later ladder/gender UI).
Idempotent: skips if already patched.
"""
from __future__ import annotations

import pathlib
import sys

MARK = "ZQ-150 wechat-subscribe"

IMPORT_BLOCK = (
    'import {\n'
    "  isWeChatMiniProgram,\n"
    "  requestSubscribeBeforeInvite,\n"
    "  requestSubscribeBeforeMessage,\n"
    "  requestSubscribeBeforeScore,\n"
    '} from "@/lib/mp-subscribe-client";\n'
)


def ensure_import(src: str) -> str:
    if "mp-subscribe-client" in src:
        return src
    needle = 'import { useI18n } from "@/components/i18n-provider";\n'
    if needle in src:
        return src.replace(needle, needle + IMPORT_BLOCK, 1)
    # Fallback: after "use client" header
    if src.startswith('"use client"'):
        parts = src.split("\n", 2)
        if len(parts) >= 2:
            return parts[0] + "\n\n" + IMPORT_BLOCK + (parts[2] if len(parts) > 2 else "")
    return IMPORT_BLOCK + "\n" + src


def inject_once(src: str, old: str, new: str, label: str) -> str:
    if MARK in new and new.strip() in src:
        print(f"  skip {label} (already present)")
        return src
    if old not in src:
        print(f"  warn {label}: anchor not found", file=sys.stderr)
        return src
    print(f"  inject {label}")
    return src.replace(old, new, 1)


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "usage: inject-friends-subscribe.py /opt/tennis-ai/components/friends-view.tsx",
            file=sys.stderr,
        )
        return 2
    path = pathlib.Path(sys.argv[1])
    if not path.is_file():
        print(f"skip: missing {path}")
        return 0
    src = path.read_text(encoding="utf-8")
    if "requestSubscribeBeforeInvite" in src and "mp-subscribe-client" in src:
        print("friends-view already patched")
        return 0

    src = ensure_import(src)

    src = inject_once(
        src,
        '  async function openIntroWithBuddy(\n'
        '    buddy: { id: string; name: string },\n'
        '    kind: "match" | "challenge",\n'
        "    openIntro: boolean,\n"
        "  ) {\n"
        "    const body = introBodyForLocale(locale);\n"
        "    setIntroBusy(true);\n"
        "    try {\n"
        '      const res = await fetch("/tennis/api/friends/intros", {\n',
        '  async function openIntroWithBuddy(\n'
        '    buddy: { id: string; name: string },\n'
        '    kind: "match" | "challenge",\n'
        "    openIntro: boolean,\n"
        "  ) {\n"
        "    const body = introBodyForLocale(locale);\n"
        "    setIntroBusy(true);\n"
        "    try {\n"
        f"      // {MARK}\n"
        "      if (isWeChatMiniProgram()) requestSubscribeBeforeInvite();\n"
        '      const res = await fetch("/tennis/api/friends/intros", {\n',
        "invite-create",
    )

    src = inject_once(
        src,
        "    setFormError(\"\");\n"
        '    setScoreNotice("");\n'
        '    setHighlightNotice("");\n'
        "    setScoreBusy(true);\n"
        "    try {\n"
        '      const res = await fetch("/tennis/api/friends/scores", {\n'
        '        method: "POST",\n',
        "    setFormError(\"\");\n"
        '    setScoreNotice("");\n'
        '    setHighlightNotice("");\n'
        "    setScoreBusy(true);\n"
        "    try {\n"
        f"      // {MARK}\n"
        "      if (isWeChatMiniProgram()) requestSubscribeBeforeScore();\n"
        '      const res = await fetch("/tennis/api/friends/scores", {\n'
        '        method: "POST",\n',
        "score-submit",
    )

    src = inject_once(
        src,
        '      const res = await fetch("/tennis/api/friends/messages", {\n'
        '        method: "POST",\n',
        f"      // {MARK}\n"
        "      if (isWeChatMiniProgram()) requestSubscribeBeforeMessage();\n"
        '      const res = await fetch("/tennis/api/friends/messages", {\n'
        '        method: "POST",\n',
        "message-send",
    )

    path.write_text(src, encoding="utf-8")
    print(f"patched {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
