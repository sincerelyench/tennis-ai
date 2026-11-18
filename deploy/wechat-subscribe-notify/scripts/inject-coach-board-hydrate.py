#!/usr/bin/env python3
"""
Surgical inject: hydrate network coach board from server on coach-view load.
Idempotent. Does not replace the whole coach-view.tsx.
"""
from __future__ import annotations

import pathlib
import sys

MARK = "ZQ-150 coach-messages hydrate"


def ensure_import(src: str) -> str:
    if "hydrateNetworkBoardFromServer" in src:
        return src
    candidates = [
        (
            "  readNetworkBoard,\n  type NetworkBoardMessage,\n} from \"@/lib/network-coach-board\";",
            "  readNetworkBoard,\n  hydrateNetworkBoardFromServer,\n  type NetworkBoardMessage,\n} from \"@/lib/network-coach-board\";",
        ),
        (
            "  readNetworkBoard,\n} from \"@/lib/network-coach-board\";",
            "  readNetworkBoard,\n  hydrateNetworkBoardFromServer,\n} from \"@/lib/network-coach-board\";",
        ),
        (
            "readNetworkBoard,\n} from \"@/lib/network-coach-board\";",
            "readNetworkBoard,\n  hydrateNetworkBoardFromServer,\n} from \"@/lib/network-coach-board\";",
        ),
    ]
    for old, new in candidates:
        if old in src:
            return src.replace(old, new, 1)
    print("warn: network-coach-board import not found", file=sys.stderr)
    return src


def inject_hydrate_after_setboard(src: str) -> str:
    """After setBoard(readNetworkBoard(X)), also hydrate from server."""
    if MARK in src:
        return src
    # Common pattern in leaveStudentMessage / leaveCoachGuidanceNote / effects
    needle = "setBoard(readNetworkBoard(networkBoardTarget));"
    if needle in src and MARK not in src:
        repl = (
            "setBoard(readNetworkBoard(networkBoardTarget));\n"
            f"    // {MARK}\n"
            "    void hydrateNetworkBoardFromServer(networkBoardTarget).then((rows) => {\n"
            "      if (rows && rows.length) setBoard(rows);\n"
            "    });"
        )
        src = src.replace(needle, repl, 1)
        print("  inject hydrate after networkBoardTarget setBoard")
    # Also when switching coach id
    needle2 = "setBoard(readNetworkBoard(nextId));"
    if needle2 in src and f"{MARK} nextId" not in src:
        repl2 = (
            "setBoard(readNetworkBoard(nextId));\n"
            f"      // {MARK} nextId\n"
            "      void hydrateNetworkBoardFromServer(nextId).then((rows) => {\n"
            "        if (rows && rows.length) setBoard(rows);\n"
            "      });"
        )
        src = src.replace(needle2, repl2, 1)
        print("  inject hydrate after nextId setBoard")
    return src


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: inject-coach-board-hydrate.py /opt/tennis-ai/components/coach-view.tsx", file=sys.stderr)
        return 2
    path = pathlib.Path(sys.argv[1])
    if not path.is_file():
        print(f"skip: missing {path}")
        return 0
    src = path.read_text(encoding="utf-8")
    if "hydrateNetworkBoardFromServer" in src and MARK in src:
        print("coach-view already patched")
        return 0
    src = ensure_import(src)
    src = inject_hydrate_after_setboard(src)
    path.write_text(src, encoding="utf-8")
    print(f"patched {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
