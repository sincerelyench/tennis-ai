"""ZQ-147 / ZQ-148: 女单 = singles ratings filtered to women, re-ranked.

Profile gender is authoritative; seed-name allowlist is fallback only when unset.
"""
import unittest


def is_female(gender, name):
    """Mirror lib/player-gender.ts isFemalePlayer (ZQ-148 precedence)."""
    g = (gender or "").strip().lower()
    if g in ("male", "m", "男"):
        return False
    if g in ("female", "f", "女", "女单"):
        return True
    allow = {"陈燕青", "ivy", "shirley"}
    return (name or "").strip().lower() in allow


class PlayerGenderLogic(unittest.TestCase):
    def test_allowlist_and_self_report(self):
        self.assertTrue(is_female(None, "陈燕青"))
        self.assertTrue(is_female("", "Ivy"))
        self.assertTrue(is_female("female", "任何人"))
        self.assertFalse(is_female("male", "Ivy"))
        self.assertFalse(is_female(None, "小猪"))

    def test_explicit_male_beats_seed_allowlist(self):
        # ZQ-148: 陈燕青 set gender=male must leave 女单.
        self.assertFalse(is_female("male", "陈燕青"))
        self.assertFalse(is_female("Male", "陈燕青"))
        self.assertFalse(is_female("男", "陈燕青"))
        self.assertFalse(is_female("m", "Shirley"))
        # Explicit female still on board even if not seed.
        self.assertTrue(is_female("female", "新人"))
        # Unset still uses seed fallback.
        self.assertTrue(is_female(None, "陈燕青"))
        self.assertTrue(is_female(None, "Shirley"))

    def test_rerank_women_from_singles(self):
        singles = [
            {"name": "A男", "gender": "male", "rating": 8.0},
            {"name": "陈燕青", "gender": None, "rating": 6.5},
            {"name": "Ivy", "gender": None, "rating": 5.5},
            {"name": "B男", "gender": "male", "rating": 7.0},
            {"name": "Shirley", "gender": "female", "rating": 6.0},
        ]
        women = [p for p in singles if is_female(p.get("gender"), p["name"])]
        women.sort(key=lambda p: (-p["rating"], p["name"]))
        ranks = [(i + 1, p["name"], p["rating"]) for i, p in enumerate(women)]
        self.assertEqual(
            ranks,
            [(1, "陈燕青", 6.5), (2, "Shirley", 6.0), (3, "Ivy", 5.5)],
        )

    def test_rerank_excludes_seed_when_male(self):
        singles = [
            {"name": "陈燕青", "gender": "male", "rating": 6.5},
            {"name": "Ivy", "gender": None, "rating": 5.5},
            {"name": "Shirley", "gender": "female", "rating": 6.0},
        ]
        women = [p for p in singles if is_female(p.get("gender"), p["name"])]
        women.sort(key=lambda p: (-p["rating"], p["name"]))
        names = [p["name"] for p in women]
        self.assertEqual(names, ["Shirley", "Ivy"])
        self.assertNotIn("陈燕青", names)


if __name__ == "__main__":
    unittest.main()
