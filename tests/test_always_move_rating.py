"""Always-move rating: MIN_VISIBLE_DELTA + stronger soft exclude.

Mirrors deploy/always-move-rating/opt-patch/lib/local-ladder.ts.
"""

from __future__ import annotations

import math
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "deploy" / "always-move-rating" / "opt-patch" / "lib" / "local-ladder.ts"
MSGS = ROOT / "deploy" / "always-move-rating" / "opt-patch" / "lib" / "i18n" / "messages.ts"

GAME_DIFF_SCALE = 1.6
EXCLUDE_GAP = 1.5
SOFT_EXCLUDE_BOOST = 0.1
SOFT_EXCLUDE_WEIGHT = 0.5
MIN_VISIBLE_DELTA = 0.1
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


def set_published(histories, ratings, pid, target, asof):
    t = clamp_rating(target)
    samples = histories[pid]
    if not samples:
        ratings[pid] = t
        return
    last = samples[-1]
    cutoff = asof.timestamp() - WINDOW_DAYS * 86400
    recent = [
        s
        for s in samples
        if datetime.fromisoformat(f"{s['date']}T12:00:00").timestamp() >= cutoff
    ]
    recent.sort(key=lambda s: (s["date"], s["matchId"]), reverse=True)
    recent = recent[:WINDOW_MATCHES]
    num = den = last_w = 0.0
    for s in recent:
        w = s["weight"] * recency_weight(s["date"], asof)
        if w <= 0:
            continue
        if s["matchId"] == last["matchId"] and s["date"] == last["date"]:
            last_w = w
            continue
        num += w * s["matchRating"]
        den += w
    if last_w <= 0:
        last["matchRating"] = t
    else:
        last["matchRating"] = clamp_rating((t * (den + last_w) - num) / last_w)
    avg = weighted_avg(histories[pid], asof)
    ratings[pid] = avg if avg is not None else t


def ensure_visible(histories, ratings, winners, losers, before, asof):
    eps = 1e-9
    for wid in winners:
        b = before[wid]
        if ratings[wid] - b < MIN_VISIBLE_DELTA - eps:
            set_published(histories, ratings, wid, b + MIN_VISIBLE_DELTA, asof)
    for lid in losers:
        b = before[lid]
        d = ratings[lid] - b
        if d >= MIN_VISIBLE_DELTA - eps:
            continue
        if d > -(MIN_VISIBLE_DELTA - eps):
            set_published(histories, ratings, lid, b - MIN_VISIBLE_DELTA, asof)


def replay(players: dict[str, float], matches: list[dict], now: datetime) -> dict[str, float]:
    ratings = dict(players)
    histories: dict[str, list[dict]] = {pid: [] for pid in players}
    for m in sorted(matches, key=lambda x: (x["date"], x["id"])):
        w_id, l_id = m["winner"], m["loser"]
        win_side, lose_side = ratings[w_id], ratings[l_id]
        soft = should_soft_exclude(win_side, lose_side)
        asof = datetime.fromisoformat(f"{m['date']}T12:00:00")
        diff = abs(win_side - lose_side)
        before = {w_id: ratings[w_id], l_id: ratings[l_id]}
        if soft:
            mr_win = clamp_rating(win_side + SOFT_EXCLUDE_BOOST)
            mr_lose = clamp_rating(lose_side - SOFT_EXCLUDE_BOOST)
            base = (
                format_weight(m.get("sets"))
                * closeness_weight(diff)
                * recency_weight(m["date"], asof)
                * SOFT_EXCLUDE_WEIGHT
            )
            for pid, mr, opp_q in (
                (w_id, mr_win, len(histories[l_id])),
                (l_id, mr_lose, len(histories[w_id])),
            ):
                histories[pid].append(
                    {
                        "matchId": m["id"],
                        "date": m["date"],
                        "matchRating": mr,
                        "weight": base * reliability_weight(opp_q),
                    }
                )
                avg = weighted_avg(histories[pid], asof)
                if avg is not None:
                    ratings[pid] = avg
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
        ensure_visible(histories, ratings, [w_id], [l_id], before, asof)
    for pid in ratings:
        avg = weighted_avg(histories[pid], now)
        if avg is not None:
            ratings[pid] = avg
    return ratings


class AlwaysMoveRatingTests(unittest.TestCase):
    def test_patch_constants(self):
        text = PATCH.read_text(encoding="utf-8")
        self.assertIn("MIN_VISIBLE_DELTA = 0.1", text)
        self.assertIn("SOFT_EXCLUDE_BOOST = 0.1", text)
        self.assertIn("SOFT_EXCLUDE_WEIGHT = 0.5", text)
        self.assertIn("ensureVisibleMatchMove", text)
        msgs = MSGS.read_text(encoding="utf-8")
        self.assertIn("至少约 0.1", msgs)

    def test_facai_favorite_win_moves_both(self):
        """陈发财 (7.5) beat 陈燕青 (6.6) 4-2 — winner was flat; must nudge."""
        now = datetime.fromisoformat("2026-11-15T12:00:00")
        players = {"facai": 7.5, "yanqing": 6.6}
        matches = [
            {
                "id": "ms-facai",
                "date": "2026-11-15",
                "winner": "facai",
                "loser": "yanqing",
                "sets": [[4, 2]],
            }
        ]
        before_f, before_y = players["facai"], players["yanqing"]
        after = replay(players, matches, now)
        self.assertGreaterEqual(round1(after["facai"] - before_f), 0.1)
        # loser may go up (overperform) or down from ensure — but must move visibly
        self.assertGreaterEqual(abs(round1(after["yanqing"]) - round1(before_y)), 0.1)

    def test_soft_exclude_moves_loser_too(self):
        now = datetime.fromisoformat("2026-11-15T12:00:00")
        strong = utr_seed(3.0)
        weak = utr_seed(2.0)
        self.assertTrue(should_soft_exclude(strong, weak))
        players = {"s": strong, "w": weak}
        matches = [
            {
                "id": "ms-soft",
                "date": "2026-11-15",
                "winner": "s",
                "loser": "w",
                "sets": [[6, 0], [6, 0]],
            }
        ]
        after = replay(players, matches, now)
        self.assertGreaterEqual(round1(after["s"] - strong), 0.1)
        self.assertLessEqual(round1(after["w"] - weak), -0.1)

    def test_near_expected_favorite_win_not_both_flat(self):
        now = datetime.fromisoformat("2026-11-15T12:00:00")
        # Same seed, decisive win — should still show move via ensure or natural
        a = utr_seed(3.0)
        b = utr_seed(3.0)
        players = {"a": a, "b": b}
        matches = [
            {
                "id": "ms-peer",
                "date": "2026-11-15",
                "winner": "a",
                "loser": "b",
                "sets": [[6, 4], [6, 4]],
            }
        ]
        after = replay(players, matches, now)
        self.assertNotEqual(round1(after["a"]), round1(after["b"]))
        self.assertGreaterEqual(abs(round1(after["a"] - a)), 0.1)


if __name__ == "__main__":
    unittest.main()
