"""UTR-like friends ladder: seed scale and ranking (no GPU).

Mirrors deploy/friends-utr/local-ladder.ts — keep comments/formula in sync.
"""

from __future__ import annotations

import json
import math
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / "deploy" / "friends-utr"


def round1(x: float) -> float:
    return round(x * 10) / 10


def utr_seed(self_level: float) -> float:
    """Seed = self-level × 2.15 on a UTR-like continuous scale."""
    return round1(self_level * 2.15)


def side_mean(ids: list[str], ratings: dict[str, float]) -> float:
    vals = [ratings[i] for i in ids if i in ratings]
    return sum(vals) / len(vals) if vals else 0.0


def actual_from_sets(sets: list[list[int]] | None) -> float:
    if not sets:
        return 1.0
    tw = tl = 0
    for w, l in sets:
        tw += w
        tl += l
    share = tw / max(1, tw + tl)
    return min(0.92, max(0.58, 0.58 + (share - 0.5) * 0.72))


def recency(date: str, now: datetime) -> float:
    age = (now - datetime.fromisoformat(f"{date}T12:00:00")).total_seconds() / 86400
    return math.exp(-max(0.0, age) / 42)


def rate_ladder(format_: str, players: list[dict], matches: list[dict], now: datetime) -> list[dict]:
    ratings = {p["id"]: utr_seed(p["ntrp"]) for p in players}
    k = 0.42 if format_ == "singles" else 0.28
    wins: dict[str, int] = {}
    losses: dict[str, int] = {}
    ordered = sorted(
        [m for m in matches if m["format"] == format_],
        key=lambda m: (m["date"], m["id"]),
    )
    for m in ordered:
        self_r = side_mean(m["winners"], ratings)
        opp_r = side_mean(m["losers"], ratings)
        actual = actual_from_sets(m.get("sets"))
        expected = 1 / (1 + 10 ** ((opp_r - self_r) / 2.4))
        step = recency(m["date"], now) * k
        for pid in m["winners"]:
            ratings[pid] = ratings.get(pid, 0) + step * (actual - expected)
            wins[pid] = wins.get(pid, 0) + 1
        for pid in m["losers"]:
            ratings[pid] = ratings.get(pid, 0) + step * (1 - actual - (1 - expected))
            losses[pid] = losses.get(pid, 0) + 1

    rows = []
    for p in players:
        rows.append(
            {
                **p,
                "rating": round1(ratings[p["id"]]),
                "seed": utr_seed(p["ntrp"]),
                "wins": wins.get(p["id"], 0),
                "losses": losses.get(p["id"], 0),
            }
        )
    rows.sort(key=lambda r: (-r["rating"], r["name"]))
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return rows


class LocalLadderUtrTest(unittest.TestCase):
    def test_seed_maps_club_band_to_utr_like(self):
        # Club 2.5–4.5 → roughly UTR-like 5–10
        self.assertEqual(utr_seed(2.5), 5.4)
        self.assertEqual(utr_seed(3.0), 6.4)
        self.assertEqual(utr_seed(4.5), 9.7)

    def test_sample_singles_leader_is_zhao(self):
        players = json.loads((DEPLOY / "ladder-players.json").read_text(encoding="utf-8"))
        matches = json.loads((DEPLOY / "ladder-matches.json").read_text(encoding="utf-8"))
        rows = rate_ladder(
            "singles",
            players,
            matches,
            datetime.fromisoformat("2026-10-07T12:00:00"),
        )
        self.assertEqual(rows[0]["name"], "赵琳")
        self.assertGreaterEqual(rows[0]["rating"], 9.0)
        # Unplayed 吴迪 stays on UTR seed
        wudi = next(r for r in rows if r["name"] == "吴迪")
        self.assertEqual(wudi["rating"], wudi["seed"])
        self.assertEqual(wudi["wins"] + wudi["losses"], 0)

    def test_i18n_targets_say_utr_not_ntrp_on_ladder_keys(self):
        msgs = json.loads((DEPLOY / "messages-target.json").read_text(encoding="utf-8"))
        for loc in ("en", "zh"):
            friends = msgs[loc]["friends"]
            blob = " ".join(friends[k] for k in ("rankLead", "seedOnly", "emptyRankDesc", "howBody"))
            self.assertIn("UTR", blob)
            # seedOnly / howBody must not advertise NTRP as the ranking scale
            self.assertNotIn("NTRP ×", blob)
            self.assertNotIn("Seed from NTRP", blob)
            self.assertNotIn("NTRP 种子", blob)


if __name__ == "__main__":
    unittest.main()
