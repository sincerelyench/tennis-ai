#!/usr/bin/env python3
"""Remove seeded demo coach 林凯教练 and strip banned fake display names from auth."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/tennis-ai")
DATA = ROOT / ".data"

BANNED = {
    "林凯教练",
    "林凯",
    "陈晓",
    "李佳",
    "周宁",
    "王硕",
    "赵琳",
    "孙凯",
    "钱芳",
    "吴迪",
    "陆明",
    "唐悦",
    "何川",
    "沈琪",
    "韩磊",
    "马婷",
    "刘洋",
    "梁浩",
    "陈雨",
    "黄凯",
    "林萱",
    "徐峰",
    "蒋宁",
    "顾然",
    "Alex Chen",
    "Alex Kim",
    "Sam Rivera",
    "Jamie Cole",
    "Yuki Sato",
    "Mei Tan",
    "Coach Lin Kai",
}


def load(path: Path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


pub_path = DATA / "coach-publish.json"
lib_path = DATA / "coach-library.json"
sel_path = DATA / "player-selected-coach.json"
auth_path = DATA / "auth.json"

pub = load(pub_path)
removed = []
for key in list(pub.keys()):
    card = pub.get(key) or {}
    name = str(card.get("displayName") or "")
    if key == "lin_kai" or name in BANNED:
        if key != "poppy":
            del pub[key]
            removed.append(key)
# Keep 涨球教练 brand on poppy
if "poppy" in pub:
    pub["poppy"]["displayName"] = "涨球教练"
dump(pub_path, pub)

lib = load(lib_path)
if "lin_kai" in lib:
    del lib["lin_kai"]
    dump(lib_path, lib)

sel = load(sel_path)
changed_sel = False
for k, v in list(sel.items()):
    if v == "lin_kai":
        del sel[k]
        changed_sel = True
if changed_sel:
    dump(sel_path, sel)

auth = load(auth_path)
users = auth.get("users") or {}
cleared = 0
for phone, user in users.items():
    if not isinstance(user, dict):
        continue
    dn = str(user.get("displayName") or "").strip()
    if dn in BANNED:
        user["displayName"] = ""
        cleared += 1
auth["users"] = users
dump(auth_path, auth)

print("removed coaches:", removed)
print("auth banned names cleared:", cleared)
print("published left:", sorted(pub.keys()))
