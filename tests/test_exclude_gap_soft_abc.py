"""ZQ-136 A+B+C: EXCLUDE_GAP 1.5 + soft exclude + copy keys.

Mirrors deploy/exclude-gap-soft-abc/opt-patch/lib/local-ladder.ts.
"""

from __future__ import annotations

import math
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "deploy" / "exclude-gap-soft-abc" / "opt-patch" / "lib" / "local-ladder.ts"
MSGS = ROOT / "deploy" / "exclude-gap-soft-abc" / "opt-patch" / "lib" / "i18n" / "messages.ts"
JOURNEY = ROOT / "deploy" / "exclude-gap-soft-abc" / "opt-patch" / "components" / "journey-view.tsx"

GAME_DIFF_SCALE = 1.6
EXCLUDE_GAP = 1.5
SOFT_EXCLUDE_BOOST = 0.05
SOFT_EXCLUDE_WEIGHT = 0.25
RATING_MIN = 1.0
RATING_MAX = 16.5
RECENCY_TAU = 120.0
WINDOW_DAYS = 365
WINDOW_MATCHES = 30
PROJECTED_THRESHOLD = 5


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


def should_soft_exclude(win_side: float, lose_side: float) -> bool:
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
    return clamp_rating(num / den) if den else None


def replay(players: dict[str, float], matches: list[dict], now: datetime) -> dict[str, float]:
    ratings = {pid: seed for pid, seed in players.items()}
    histories: dict[str, list[dict]] = {pid: [] for pid in players}
    for m in sorted(matches, key=lambda x: (x["date"], x["id"])):
        w_id, l_id = m["winner"], m["loser"]
        win_side, lose_side = ratings[w_id], ratings[l_id]
        soft = should_soft_exclude(win_side, lose_side)
        asof = datetime.fromisoformat(f"{m['date']}T12:00:00")
        diff = abs(win_side - lose_side)
        if soft:
            mr_win = clamp_rating(win_side + SOFT_EXCLUDE_BOOST)
            base = (
                format_weight(m.get("sets"))
                * closeness_weight(diff)
                * recency_weight(m["date"], asof)
                * SOFT_EXCLUDE_WEIGHT
            )
            w = base * reliability_weight(len(histories[l_id]))
            histories[w_id].append(
                {"matchId": m["id"], "date": m["date"], "matchRating": mr_win, "weight": w}
            )
            avg = weighted_avg(histories[w_id], asof)
            if avg is not None:
                ratings[w_id] = avg
        else:
            share = winner_game_share(m.get("sets"))
            mr_win = clamp_rating(max(lose_side + rating_edge(share), win_side))
            mr_lose = clamp_rating(win_side + rating_edge(1 - share))
            base = (
                format_weight(m.get("sets"))
                * closeness_weight(diff)
                * recency_weight(m["date"], asof)
            )
            histories[w_id].append(
                {
                    "matchId": m["id"],
                    "date": m["date"],
                    "matchRating": mr_win,
                    "weight": base * reliability_weight(len(histories[l_id])),
                }
            )
            histories[l_id].append(
                {
                    "matchId": m["id"],
                    "date": m["date"],
                    "matchRating": mr_lose,
                    "weight": base * reliability_weight(len(histories[w_id]) - 1),
                }
            )
            for pid in (w_id, l_id):
                avg = weighted_avg(histories[pid], asof)
                if avg is not None:
                    ratings[pid] = avg
    for pid in ratings:
        avg = weighted_avg(histories[pid], now)
        if avg is not None:
            ratings[pid] = avg
    return ratings


class ExcludeGapSoftAbcTests(unittest.TestCase):
    def test_patch_constants(self):
        text = PATCH.read_text(encoding="utf-8")
        self.assertIn("EXCLUDE_GAP = 1.5", text)
        self.assertIn("SOFT_EXCLUDE_BOOST = 0.05", text)
        self.assertIn("SOFT_EXCLUDE_WEIGHT = 0.25", text)
        self.assertIn("shouldSoftExcludeBlowout", text)

    def test_copy_keys(self):
        text = MSGS.read_text(encoding="utf-8")
        self.assertIn("softExcludeHint", text)
        self.assertIn("barelyCountHint", text)
        self.assertIn("弱敌胜：仅小幅计入", text)
        self.assertIn("分差大于 1.5", text)
        self.assertNotRegex(text, r"分差大于 2\.0 的一边倒热门胜不计")
        journey = JOURNEY.read_text(encoding="utf-8")
        self.assertIn("softExcludeHint", journey)
        self.assertIn("barelyCountHint", journey)

    def test_gap_1_07_full_weight_not_soft(self):
        """陈燕青 6.45 vs Ivy 5.38 gap≈1.07 ≤ 1.5 → full path."""
        y, ivy = utr_seed(3.0), utr_seed(2.5)
        self.assertAlmostEqual(y - ivy, 1.07, places=2)
        self.assertFalse(should_soft_exclude(y, ivy))

    def test_yanqing_three_wins_move_via_allen(self):
        now = datetime.fromisoformat("2026-11-14T12:00:00")
        players = {
            "y": utr_seed(3.0),
            "i": utr_seed(2.5),
            "a": utr_seed(2.5),
            "p": utr_seed(2.5),
        }
        matches = [
            {
                "id": "ms-ivy",
                "date": "2026-11-13",
                "winner": "y",
                "loser": "i",
                "sets": [[4, 2], [4, 0]],
            },
            {
                "id": "ms-allen",
                "date": "2026-11-13",
                "winner": "y",
                "loser": "a",
                "sets": [[6, 1], [6, 2], [6, 0]],
            },
            {
                "id": "ms-pig",
                "date": "2026-11-14",
                "winner": "y",
                "loser": "p",
                "sets": [[6, 0], [2, 6], [6, 1]],
            },
        ]
        before = players["y"]
        after = replay(players, matches, now)["y"]
        self.assertGreaterEqual(round1(after), 6.5)
        self.assertGreaterEqual(round1(after - before), 0.1)

    def test_soft_exclude_gives_small_positive(self):
        """gap > 1.5 favorite win → soft boost, not hard zero."""
        now = datetime.fromisoformat("2026-11-14T12:00:00")
        strong = utr_seed(3.0)  # 6.45
        weak = utr_seed(2.0)  # 4.30, gap 2.15 > 1.5
        self.assertTrue(should_soft_exclude(strong, weak))
        players = {"s": strong, "w": weak}
        matches = [
            {
                "id": "ms-soft",
                "date": "2026-11-14",
                "winner": "s",
                "loser": "w",
                "sets": [[6, 0], [6, 0]],
            }
        ]
        after = replay(players, matches, now)
        # Thin history → published ≈ pre + 0.05
        self.assertAlmostEqual(after["s"], strong + SOFT_EXCLUDE_BOOST, places=2)
        self.assertEqual(round1(after["w"]), round1(weak))  # loser rating unchanged


if __name__ == "__main__":
    unittest.main()
