#!/usr/bin/env python3
"""Seed a published network coach distinct from 涨球教练 (never Poppy)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/tennis-ai")
DATA = ROOT / ".data"
DATA.mkdir(parents=True, exist_ok=True)

NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
NET_ID = "lin_kai"

pub_path = DATA / "coach-publish.json"
lib_path = DATA / "coach-library.json"
sel_path = DATA / "player-selected-coach.json"


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


pub = load(pub_path)
# Keep built-in card branded 涨球教练
pub["poppy"] = {
    **pub.get("poppy", {}),
    "coachId": "poppy",
    "displayName": "涨球教练",
    "styleTagline": pub.get("poppy", {}).get("styleTagline") or "稳健底线，强调随挥放松",
    "status": "published",
    "publishedAt": pub.get("poppy", {}).get("publishedAt") or NOW,
    "libraryStrokeCount": max(1, int(pub.get("poppy", {}).get("libraryStrokeCount") or 1)),
    "updatedAt": NOW,
}
pub[NET_ID] = {
    "coachId": NET_ID,
    "displayName": "林凯教练",
    "styleTagline": "底线对抗 · 脚步先行",
    "status": "published",
    "trainJob": {
        "id": f"train_{NET_ID}",
        "status": "ready",
        "startedAt": NOW,
        "readyAt": NOW,
        "progress": 100,
        "note": "Seeded network coach for Q&A chat",
    },
    "submittedAt": NOW,
    "publishedAt": NOW,
    "rejectedReason": None,
    "libraryStrokeCount": 2,
    "updatedAt": NOW,
}
pub_path.write_text(json.dumps(pub, ensure_ascii=False, indent=2) + "\n")

lib = load(lib_path)
lib[NET_ID] = {
    "coachId": NET_ID,
    "coachName": "林凯教练",
    "entries": {
        "fh-topspin": {
            "strokeId": "fh-topspin",
            "prompt": "林凯：先用小碎步调整站位，再送拍；击球点在身前一个球的距离。",
            "videoUrl": "",
            "title": "正手站位",
            "updatedAt": NOW,
        },
        "bh-topspin": {
            "strokeId": "bh-topspin",
            "prompt": "林凯：侧身要早，非持拍手引导肩转，再送拍过网。",
            "videoUrl": "",
            "title": "反手侧身",
            "updatedAt": NOW,
        },
    },
    "updatedAt": NOW,
}
# Ensure built-in library name is 涨球教练
if "poppy" in lib:
    lib["poppy"]["coachName"] = "涨球教练"
lib_path.write_text(json.dumps(lib, ensure_ascii=False, indent=2) + "\n")

sel = load(sel_path)
# Default demo player → network coach so Coach tab shows both chips
if not sel:
    sel = {"player_local": NET_ID, "13800000001": NET_ID}
else:
    for k, v in list(sel.items()):
        if v in ("poppy", "", None):
            sel[k] = NET_ID
    sel.setdefault("player_local", NET_ID)
sel_path.write_text(json.dumps(sel, ensure_ascii=False, indent=2) + "\n")

print(f"seeded {NET_ID} into {DATA}")
print(f"published coaches: {sorted(pub.keys())}")
