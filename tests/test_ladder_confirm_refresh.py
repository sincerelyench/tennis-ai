"""ZQ-131: document twin-id + refresh expectations (static checks on deploy kit)."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "deploy" / "ladder-confirm-refresh" / "opt-patch"


class LadderConfirmRefreshKit(unittest.TestCase):
    def test_match_scores_binds_submitter_phone(self) -> None:
        src = (KIT / "lib" / "match-scores.ts").read_text(encoding="utf-8")
        self.assertIn("preferPhone", src)
        self.assertIn("preferCityId", src)
        self.assertIn("1390000000", src)
        self.assertIn("Always bind both sides from submitter", src)
        self.assertIn("if (submitterNorm === aNorm) playerAId = input.submitterPhone", src)

    def test_friends_view_refreshes_city_and_polls(self) -> None:
        src = (KIT / "components" / "friends-view.tsx").read_text(encoding="utf-8")
        self.assertIn("refreshCityMatches()", src)
        self.assertIn("录入方等待对方确认时轮询", src)
        # confirm path must include city results refresh
        idx = src.find("onScoreAction")
        self.assertGreater(idx, 0)
        chunk = src[idx : idx + 1200]
        self.assertIn("refreshCityMatches()", chunk)


if __name__ == "__main__":
    unittest.main()
