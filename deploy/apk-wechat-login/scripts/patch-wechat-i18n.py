#!/usr/bin/env python3
from pathlib import Path
import re

import os
root = Path(os.environ.get("TENNIS_ROOT", "/opt/tennis-ai"))
p = root / "lib/i18n/messages.ts"
t = p.read_text()

en_inject = """
      wechat: "Continue with WeChat",
      wechatSubmitting: "Signing in with WeChat…",
      wechatFail: "WeChat sign-in failed. Try again or use your phone number.",
      wechatWebHint: "WeChat sign-in works in the 涨球 app or mini program. On the website, use your phone number.",
      orPhone: "or use phone number","""

zh_inject = """
      wechat: "微信登录",
      wechatSubmitting: "正在微信登录…",
      wechatFail: "微信登录失败，请重试或改用手机号。",
      wechatWebHint: "微信登录请在涨球 App 或小程序中使用；网页端请用手机号登录。",
      orPhone: "或使用手机号登录","""


def patch_login(text: str, inject: str, which: int) -> str:
    start = -1
    search = 0
    for _ in range(which + 1):
        start = text.find("login: {", search)
        if start < 0:
            raise SystemExit(f"login block {which} not found")
        search = start + 1
    depth = 0
    j = start + len("login: ")
    end = None
    while j < len(text):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                end = j
                break
        j += 1
    if end is None:
        raise SystemExit(f"unclosed login block {which}")
    block = text[start : end + 1]
    if "wechat:" in block:
        print(f"block {which} already has wechat")
        return text
    m = re.search(r'(signFail:\s*"[^"]*")\s*}', block)
    if not m:
        raise SystemExit(f"cannot parse signFail in block {which}: {block[-120:]!r}")
    new_block = block[: m.start()] + m.group(1) + "," + inject + "\n    }"
    return text[:start] + new_block + text[end + 1 :]


t2 = patch_login(t, en_inject, 0)
t2 = patch_login(t2, zh_inject, 1)
p.write_text(t2)
print("patched wechat=", t2.count("wechat:"), "orPhone=", t2.count("orPhone:"))
