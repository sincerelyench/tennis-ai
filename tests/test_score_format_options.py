"""ZQ-140: match-length / short-format helpers + formatWeight caveats (mirror)."""

from __future__ import annotations

import unittest


def normalize_match_length(raw: object) -> str:
    v = str(raw or "").strip().lower()
    if v in {"bo5", "bestof5", "5"}:
        return "bo5"
    if v in {"single", "oneset", "1", "proset"}:
        return "single"
    return "bo3"


def normalize_short_format(raw: object) -> str:
    v = str(raw or "").strip().lower()
    if v in {"race7", "to7", "7"}:
        return "race7"
    if v in {"race10", "to10", "10"}:
        return "race10"
    return "free"


def max_sets_for_length(length: str) -> int:
    if length == "bo5":
        return 5
    if length == "single":
        return 1
    return 3


def race_target(short: str | None) -> int | None:
    if short == "race7":
        return 7
    if short == "race10":
        return 10
    return None


def winner_from_sets(sets: list[tuple[int, int]]) -> str | None:
    wa = wb = 0
    for a, b in sets:
        if a == b:
            continue
        if a > b:
            wa += 1
        else:
            wb += 1
    if wa == wb:
        return None
    return "A" if wa > wb else "B"


def winner_game_share(sets: list[tuple[int, int]]) -> tuple[float, int]:
    tw = tl = 0
    for w, l in sets:
        tw += w
        tl += l
    total = tw + tl
    if total <= 0:
        return 0.85, 0
    return tw / total, total


def format_weight(sets: list[tuple[int, int]] | None) -> float:
    if not sets:
        return 0.75
    if len(sets) >= 5:
        return 1.2
    if len(sets) >= 3:
        return 1.15
    total = sum(a + b for a, b in sets)
    if len(sets) == 1 or total <= 12:
        return 0.8
    return 1.0


class ScoreFormatOptionsTest(unittest.TestCase):
    def test_defaults_and_aliases(self):
        self.assertEqual(normalize_match_length(""), "bo3")
        self.assertEqual(normalize_match_length("bo5"), "bo5")
        self.assertEqual(normalize_match_length("single"), "single")
        self.assertEqual(normalize_short_format(None), "free")
        self.assertEqual(normalize_short_format("race7"), "race7")
        self.assertEqual(max_sets_for_length("bo3"), 3)
        self.assertEqual(max_sets_for_length("bo5"), 5)
        self.assertEqual(max_sets_for_length("single"), 1)

    def test_race_target_soft_rule(self):
        self.assertEqual(race_target("race7"), 7)
        self.assertEqual(race_target("race10"), 10)
        self.assertIsNone(race_target("free"))
        # 7-5 ok for 抢7; 6-4 fails target
        sets_ok = [(7, 5)]
        sets_bad = [(6, 4)]
        self.assertEqual(winner_from_sets(sets_ok), "A")
        win = winner_from_sets(sets_ok)
        ga, gb = sets_ok[0]
        self.assertGreaterEqual(ga if win == "A" else gb, 7)
        win_bad = winner_from_sets(sets_bad)
        ga, gb = sets_bad[0]
        self.assertLess(ga if win_bad == "A" else gb, 7)

    def test_games_parse_for_utr(self):
        # Remap winner-first as ladder does for B wins
        raw = [(4, 7)]  # B wins 抢7
        remapped = [(7, 4)]
        share, total = winner_game_share(remapped)
        self.assertEqual(total, 11)
        self.assertAlmostEqual(share, 7 / 11)
        # Bo5 three sets
        bo5 = [(6, 4), (3, 6), (6, 2), (6, 3)]
        share2, total2 = winner_game_share(bo5)
        self.assertEqual(total2, 36)
        self.assertGreater(share2, 0.5)

    def test_format_weight_short_and_bo5(self):
        self.assertEqual(format_weight([(7, 5)]), 0.8)  # 抢7
        self.assertEqual(format_weight([(10, 8)]), 0.8)  # 抢10 one set
        self.assertEqual(format_weight([(6, 4), (6, 3)]), 1.0)
        self.assertEqual(format_weight([(6, 4), (3, 6), (6, 2)]), 1.15)
        self.assertEqual(
            format_weight([(6, 4), (6, 3), (4, 6), (3, 6), (6, 2)]),
            1.2,
        )


if __name__ == "__main__":
    unittest.main()
