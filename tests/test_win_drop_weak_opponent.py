"""ZQ-122: win vs much-weaker → rating unchanged; counted wins never lower rating.

Mirrors deploy/win-drop-weak-opponent/opt-patch/lib/local-ladder.ts.
"""

from __future__ import annotations

import math
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "deploy" / "win-drop-weak-opponent" / "opt-patch" / "lib" / "local-ladder.ts"
MSGS = ROOT / "deploy" / "win-drop-weak-opponent" / "opt-patch" / "lib" / "i18n" / "messages.ts"

GAME_DIFF_SCALE = 1.6
EXCLUDE_GAP = 1.0
PROJECTED_THRESHOLD = 5
RATING_MIN = 1.0
RATING_MAX = 16.5
RECENCY_TAU = 120.0
WINDOW_DAYS = 365
WINDOW_MATCHES = 30


def round1(x: float) -> float:
    return round(x * 10) / 10


def round2(x: float) -> float:
    return round(x * 100) / 100


def clamp_rating(x: float) -> float:
    return min(RATING_MAX, max(RATING_MIN, x))


def utr_seed(level: float) -> float:
    return clamp_rating(round2(level * 2.15))


def clamp_pct(p: float) -> float:
    return min(0.98, max(0.02, p))


def rating_edge(pct: float) -> float:
    p = clamp_pct(pct)
    return GAME_DIFF_SCALE * math.log10(p / (1 - p))


def winner_game_share(sets: list[list[int]] | None) -> float:
    if not sets:
        return 0.85
    tw = tl = 0
    for w, l in sets:
        tw += w
        tl += l
    total = tw + tl
    return 0.85 if total <= 0 else tw / total


def should_exclude(win_side: float, lose_side: float) -> bool:
    gap = abs(win_side - lose_side)
    if gap <= EXCLUDE_GAP:
        return False
    return win_side > lose_side


def format_weight(sets: list[list[int]] | None) -> float:
    if not sets:
        return 0.75
    if len(sets) >= 3:
        return 1.15
    total = sum(a + b for a, b in sets)
    if len(sets) == 1 or total <= 12:
        return 0.8
    return 1.0


def closeness_weight(diff: float) -> float:
    return math.exp(-abs(diff) / 1.2)


def reliability_weight(opp_q: int) -> float:
    if opp_q <= 0:
        return 0.55
    if opp_q < PROJECTED_THRESHOLD:
        return 0.55 + 0.3 * opp_q / PROJECTED_THRESHOLD
    return min(1.2, 0.9 + 0.03 * min(opp_q, 10))


def age_days(date: str, now: datetime) -> float:
    return max(0.0, (now - datetime.fromisoformat(f"{date}T12:00:00")).total_seconds() / 86400)


def recency_weight(date: str, now: datetime) -> float:
    return math.exp(-age_days(date, now) / RECENCY_TAU)


def side_mean(ids: list[str], ratings: dict[str, float]) -> float:
    vals = [ratings[i] for i in ids if i in ratings]
    return sum(vals) / len(vals) if vals else 0.0


def weighted_avg(samples: list[dict], now: datetime) -> float | None:
    cutoff = now.timestamp() - WINDOW_DAYS * 86400
    recent = [
        s
        for s in samples
        if datetime.fromisoformat(f"{s['date']}T12:00:00").timestamp() >= cutoff
    ]
    recent.sort(key=lambda s: (s["date"], s["matchId"]), reverse=True)
    recent = recent[:WINDOW_MATCHES]
    if not recent:
        return None
    num = den = 0.0
    for s in recent:
        w = s["weight"] * recency_weight(s["date"], now)
        if w <= 0:
            continue
        num += w * s["matchRating"]
        den += w
    return None if den <= 0 else clamp_rating(num / den)


def rate_ladder(
    players: list[dict],
    matches: list[dict],
    now: datetime,
    format_: str = "singles",
) -> list[dict]:
    ratings = {p["id"]: utr_seed(p["ntrp"]) for p in players}
    histories: dict[str, list[dict]] = {p["id"]: [] for p in players}
    wins: dict[str, int] = {}
    losses: dict[str, int] = {}

    ordered = sorted(
        [m for m in matches if m["format"] == format_],
        key=lambda m: (m["date"], m["id"]),
    )
    for m in ordered:
        win_side = side_mean(m["winners"], ratings)
        lose_side = side_mean(m["losers"], ratings)
        for pid in m["winners"]:
            wins[pid] = wins.get(pid, 0) + 1
        for pid in m["losers"]:
            losses[pid] = losses.get(pid, 0) + 1
        if should_exclude(win_side, lose_side):
            continue

        share = winner_game_share(m.get("sets"))
        mr_win = clamp_rating(lose_side + rating_edge(share))
        mr_lose = clamp_rating(win_side + rating_edge(1 - share))
        # Winner floor: counted win never produces MR below pre-match rating.
        mr_win = clamp_rating(max(mr_win, win_side))
        as_of = datetime.fromisoformat(f"{m['date']}T12:00:00")
        diff = abs(win_side - lose_side)
        base = format_weight(m.get("sets")) * closeness_weight(diff) * recency_weight(m["date"], as_of)

        def qcount(pid: str) -> int:
            return len(histories[pid])

        win_opp_q = min(qcount(i) for i in m["losers"])
        lose_opp_q = min(qcount(i) for i in m["winners"])

        for pid in m["winners"]:
            histories[pid].append(
                {
                    "matchId": m["id"],
                    "date": m["date"],
                    "matchRating": mr_win,
                    "weight": base * reliability_weight(win_opp_q),
                }
            )
            avg = weighted_avg(histories[pid], as_of)
            if avg is not None:
                ratings[pid] = avg
        for pid in m["losers"]:
            histories[pid].append(
                {
                    "matchId": m["id"],
                    "date": m["date"],
                    "matchRating": mr_lose,
                    "weight": base * reliability_weight(lose_opp_q),
                }
            )
            avg = weighted_avg(histories[pid], as_of)
            if avg is not None:
                ratings[pid] = avg

    rows = []
    for p in players:
        avg = weighted_avg(histories[p["id"]], now)
        rating = avg if avg is not None else utr_seed(p["ntrp"])
        cutoff = now.timestamp() - WINDOW_DAYS * 86400
        qualified = sum(
            1
            for s in histories[p["id"]]
            if datetime.fromisoformat(f"{s['date']}T12:00:00").timestamp() >= cutoff
        )
        qualified = min(qualified, WINDOW_MATCHES)
        rows.append(
            {
                **p,
                "rating": round1(rating),
                "seed": round1(utr_seed(p["ntrp"])),
                "wins": wins.get(p["id"], 0),
                "losses": losses.get(p["id"], 0),
                "qualifiedMatches": qualified,
                "projected": qualified < PROJECTED_THRESHOLD,
            }
        )
    rows.sort(key=lambda r: (-r["rating"], r["name"]))
    return rows


class WinDropWeakOpponentTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime.fromisoformat("2026-11-13T12:00:00")
        self.assertTrue(PATCH.is_file(), "opt-patch local-ladder.ts missing")

    def test_patch_exclude_gap_is_one(self):
        src = PATCH.read_text(encoding="utf-8")
        self.assertIn("EXCLUDE_GAP = 1.0", src)
        self.assertIn("Math.max(mrWin, winSide)", src)
        self.assertNotIn("EXCLUDE_GAP = 2.0", src)

    def test_ntrp_30_beats_25_unchanged(self):
        """NTRP 3.0 beats 2.5 (~UTR gap 1.07) → favorite win ignored, Δ = 0."""
        players = [
            {"id": "a", "name": "A", "ntrp": 3.0},
            {"id": "b", "name": "B", "ntrp": 2.5},
        ]
        gap = abs(utr_seed(3.0) - utr_seed(2.5))
        self.assertGreater(gap, EXCLUDE_GAP)
        rows = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-13",
                        "format": "singles",
                        "winners": ["a"],
                        "losers": ["b"],
                        "sets": [[4, 2], [4, 0]],
                    }
                ],
                self.now,
            )
        }
        self.assertEqual(rows["a"]["rating"], rows["a"]["seed"])
        self.assertEqual(rows["b"]["rating"], rows["b"]["seed"])
        self.assertEqual(rows["a"]["wins"], 1)
        self.assertEqual(rows["a"]["qualifiedMatches"], 0)

    def test_yanqing_vs_ivy_style_unchanged(self):
        """陈燕青-style 6.5 seed vs Ivy 5.4: gap > 1.0 favorite win → unchanged."""
        players = [
            {"id": "y", "name": "Yanqing", "ntrp": 3.0},
            {"id": "i", "name": "Ivy", "ntrp": 2.5},
        ]
        rows = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-13",
                        "format": "singles",
                        "winners": ["y"],
                        "losers": ["i"],
                        "sets": [[4, 2], [4, 0]],
                    }
                ],
                self.now,
            )
        }
        self.assertEqual(rows["y"]["rating"], rows["y"]["seed"])
        self.assertGreaterEqual(rows["y"]["rating"] - rows["y"]["seed"], 0)

    def test_similar_level_win_can_gain(self):
        """UTR ~6.5 beats ~6.3 → gap < 1.0, winner can gain."""
        players = [
            {"id": "a", "name": "A", "ntrp": 6.5 / 2.15},
            {"id": "b", "name": "B", "ntrp": 6.3 / 2.15},
        ]
        gap = abs(utr_seed(6.5 / 2.15) - utr_seed(6.3 / 2.15))
        self.assertLessEqual(gap, EXCLUDE_GAP)
        rows = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-13",
                        "format": "singles",
                        "winners": ["a"],
                        "losers": ["b"],
                        "sets": [[6, 4], [6, 4]],
                    }
                ],
                self.now,
            )
        }
        self.assertGreater(rows["a"]["rating"] - rows["a"]["seed"], 0.05)
        self.assertEqual(rows["a"]["qualifiedMatches"], 1)

    def test_counted_close_win_vs_somewhat_weaker_never_drops(self):
        """Gap < 1.0 but thin-history MR would dip → winner floor keeps seed."""
        players = [
            {"id": "a", "name": "A", "ntrp": 6.5 / 2.15},
            {"id": "b", "name": "B", "ntrp": 5.8 / 2.15},
        ]
        gap = abs(utr_seed(6.5 / 2.15) - utr_seed(5.8 / 2.15))
        self.assertLessEqual(gap, EXCLUDE_GAP)
        rows = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-13",
                        "format": "singles",
                        "winners": ["a"],
                        "losers": ["b"],
                        "sets": [[7, 5], [7, 6]],
                    }
                ],
                self.now,
            )
        }
        self.assertGreaterEqual(rows["a"]["rating"], rows["a"]["seed"])

    def test_messages_mention_gap_one_and_hint(self):
        text = MSGS.read_text(encoding="utf-8")
        self.assertIn("分差 > 1.0", text)
        self.assertIn("赢球掉分：对手比自己弱", text)
        self.assertIn("winDropWeakHint", text)
        self.assertNotIn("分差 > 2.0 且高分者按预期获胜", text)


if __name__ == "__main__":
    unittest.main()
