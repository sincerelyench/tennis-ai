#!/usr/bin/env python3
"""Expand BANNED_DISPLAY_NAMES and ensure ladderPlayers stays empty."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/tennis-ai")

BANNED = (
    r"/^(林凯教练|林凯|陈晓|李佳|周宁|王硕|赵琳|孙凯|钱芳|吴迪|陆明|唐悦|何川|沈琪|韩磊|马婷|"
    r"刘洋|梁浩|陈雨|黄凯|林萱|徐峰|蒋宁|顾然|Alex Chen|Alex Kim|Sam Rivera|Jamie Cole|"
    r"Yuki Sato|Mei Tan|Coach Lin Kai|"
    r"111|Help Tip Demo|Restore QA|Signup Demo|ZQ85|zqdemo|probe|webview测试|"
    r"yanqing|chenyanqing|yanqing Chen|严庆测试|位置测试|小朱|截图账号|截图验证|"
    r"测试球友甲|测试球员甲|涨球测试|空成绩测试)$/i"
)

auth = ROOT / "lib" / "auth-store.ts"
if auth.exists():
    text = auth.read_text(encoding="utf-8")
    new_text, n = re.subn(
        r"const BANNED_DISPLAY_NAMES\s*=\s*/\^[\s\S]*?/i;",
        f"const BANNED_DISPLAY_NAMES =\n  {BANNED};",
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"failed to patch BANNED_DISPLAY_NAMES in {auth} (n={n})")
    auth.write_text(new_text, encoding="utf-8")
    print(f"patched {auth}")
else:
    print(f"skip missing {auth}")

ladder = ROOT / "lib" / "local-ladder.ts"
if ladder.exists():
    text = ladder.read_text(encoding="utf-8")
    new_text, n = re.subn(
        r"export const ladderPlayers:\s*LadderPlayer\[\]\s*=\s*\[[\s\S]*?\];",
        "export const ladderPlayers: LadderPlayer[] = [];",
        text,
        count=1,
    )
    if n == 0:
        # Already empty single-line form or different formatting — verify empty.
        if "export const ladderPlayers: LadderPlayer[] = [];" in text:
            print(f"ladderPlayers already empty in {ladder}")
        else:
            raise SystemExit(f"could not locate ladderPlayers in {ladder}")
    else:
        ladder.write_text(new_text, encoding="utf-8")
        print(f"emptied ladderPlayers in {ladder}")
else:
    print(f"skip missing {ladder}")
