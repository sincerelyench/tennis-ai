"""UTR-style local ladder fixtures (ZQ-71).

Mirrors deploy/official-utr-ladder/opt-patch/lib/local-ladder.ts —
games % vs expected → match rating → ≤30 / 12-month weighted average.
Not official Universal Tennis.
"""

from __future__ import annotations

import math
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "deploy" / "official-utr-ladder" / "opt-patch" / "lib" / "local-ladder.ts"

GAME_DIFF_SCALE = 1.6
EXCLUDE_GAP = 2.0
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


def expected_game_pct(self_r: float, opp_r: float) -> float:
    return 1 / (1 + 10 ** ((opp_r - self_r) / GAME_DIFF_SCALE))


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
        if should_exclude(win_side, lose_side):
            for pid in m["winners"]:
                wins[pid] = wins.get(pid, 0) + 1
            for pid in m["losers"]:
                losses[pid] = losses.get(pid, 0) + 1
            continue

        share = winner_game_share(m.get("sets"))
        mr_win = clamp_rating(lose_side + rating_edge(share))
        mr_lose = clamp_rating(win_side + rating_edge(1 - share))
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
            wins[pid] = wins.get(pid, 0) + 1
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
            losses[pid] = losses.get(pid, 0) + 1

    rows = []
    for p in players:
        avg = weighted_avg(histories[p["id"]], now)
        rating = avg if avg is not None else utr_seed(p["ntrp"])
        qualified = len(
            [
                s
                for s in histories[p["id"]]
                if (now - datetime.fromisoformat(f"{s['date']}T12:00:00")).days <= WINDOW_DAYS
            ][:WINDOW_MATCHES]
        )
        # recount with same window helper
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


class OfficialUtrLadderTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime.fromisoformat("2026-11-09T12:00:00")
        self.assertTrue(PATCH.is_file(), "opt-patch local-ladder.ts missing")

    def test_seed_scale(self):
        self.assertEqual(round1(utr_seed(2.5)), 5.4)
        self.assertEqual(round1(utr_seed(3.5)), 7.5)
        self.assertEqual(round1(utr_seed(4.5)), 9.7)
        self.assertGreaterEqual(utr_seed(1.0), RATING_MIN)
        self.assertLessEqual(utr_seed(8.0), RATING_MAX)

    def test_same_level_close_win_moves_both(self):
        players = [
            {"id": "a", "name": "A", "ntrp": 3.5},
            {"id": "b", "name": "B", "ntrp": 3.5},
        ]
        matches = [
            {
                "id": "m1",
                "date": "2026-11-01",
                "format": "singles",
                "winners": ["a"],
                "losers": ["b"],
                "sets": [[6, 4], [6, 4]],
            }
        ]
        rows = {r["id"]: r for r in rate_ladder(players, matches, self.now)}
        d_a = rows["a"]["rating"] - rows["a"]["seed"]
        d_b = rows["b"]["rating"] - rows["b"]["seed"]
        self.assertGreater(d_a, 0.1)
        self.assertLess(d_b, -0.1)
        # roughly zero-sum on published 1-decimal ratings
        self.assertAlmostEqual(d_a + d_b, 0.0, delta=0.05)
        self.assertTrue(rows["a"]["projected"])

    def test_blowout_gap_over_2_favorite_win_excluded(self):
        players = [
            {"id": "s", "name": "Strong", "ntrp": 4.5},
            {"id": "w", "name": "Weak", "ntrp": 2.5},
        ]
        gap = abs(utr_seed(4.5) - utr_seed(2.5))
        self.assertGreater(gap, EXCLUDE_GAP)
        matches = [
            {
                "id": "m1",
                "date": "2026-11-01",
                "format": "singles",
                "winners": ["s"],
                "losers": ["w"],
                "sets": [[6, 0], [6, 0]],
            }
        ]
        rows = {r["id"]: r for r in rate_ladder(players, matches, self.now)}
        self.assertEqual(rows["s"]["rating"], rows["s"]["seed"])
        self.assertEqual(rows["w"]["rating"], rows["w"]["seed"])
        self.assertEqual(rows["s"]["qualifiedMatches"], 0)
        self.assertEqual(rows["s"]["wins"], 1)  # W–L still tracked

    def test_underdog_close_loss_moves_more_than_crush(self):
        players = [
            {"id": "u", "name": "Under", "ntrp": 3.0},
            {"id": "f", "name": "Fav", "ntrp": 3.5},
        ]
        gap = abs(utr_seed(3.0) - utr_seed(3.5))
        self.assertLessEqual(gap, EXCLUDE_GAP)

        close = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-01",
                        "format": "singles",
                        "winners": ["f"],
                        "losers": ["u"],
                        "sets": [[6, 4], [7, 5]],
                    }
                ],
                self.now,
            )
        }
        crush = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-01",
                        "format": "singles",
                        "winners": ["f"],
                        "losers": ["u"],
                        "sets": [[6, 0], [6, 1]],
                    }
                ],
                self.now,
            )
        }
        d_close = close["u"]["rating"] - close["u"]["seed"]
        d_crush = crush["u"]["rating"] - crush["u"]["seed"]
        # Close loss over-performs expected games → larger (less negative / positive) move
        self.assertGreater(d_close, d_crush)
        self.assertGreater(d_close, 0.1)

    def test_upset_moves_more_than_point_one(self):
        players = [
            {"id": "u", "name": "Under", "ntrp": 3.0},
            {"id": "f", "name": "Fav", "ntrp": 3.5},
        ]
        rows = {
            r["id"]: r
            for r in rate_ladder(
                players,
                [
                    {
                        "id": "m1",
                        "date": "2026-11-01",
                        "format": "singles",
                        "winners": ["u"],
                        "losers": ["f"],
                        "sets": [[6, 4], [6, 4]],
                    }
                ],
                self.now,
            )
        }
        self.assertGreater(rows["u"]["rating"] - rows["u"]["seed"], 0.1)

    def test_patch_source_mentions_utr_style_not_elo_k(self):
        src = PATCH.read_text(encoding="utf-8")
        self.assertIn("match rating", src.lower())
        self.assertIn("WINDOW_MATCHES = 30", src)
        self.assertIn("EXCLUDE_GAP = 2.0", src)
        self.assertNotIn("K = 0.42", src)
        self.assertIn("NOT official UTR", src)

    def test_help_copy_zh_mentions_games_vs_expected(self):
        msgs = (
            ROOT
            / "deploy"
            / "official-utr-ladder"
            / "opt-patch"
            / "lib"
            / "i18n"
            / "messages.ts"
        ).read_text(encoding="utf-8")
        self.assertIn("实际赢局比例对比预期", msgs)
        self.assertIn("最多 30 场", msgs)
        self.assertIn("分差 > 2.0", msgs)
        self.assertIn("(P) 投影分", msgs)
        self.assertNotIn("步长 K = 0.42", msgs)
        self.assertNotIn("Elo-style expected win", msgs)


if __name__ == "__main__":
    unittest.main()
