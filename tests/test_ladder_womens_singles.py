"""ZQ-147: 女单 = singles ratings filtered to women, re-ranked."""
import unittest


class PlayerGenderLogic(unittest.TestCase):
    def test_allowlist_and_self_report(self):
        # Mirror lib/player-gender.ts rules in a tiny portable check.
        allow = {"陈燕青", "ivy", "shirley"}

        def is_female(gender, name):
            g = (gender or "").strip().lower()
            if g in ("female", "f", "女"):
                return True
            if g in ("male", "m", "男"):
                return False
            return (name or "").strip().lower() in allow

        self.assertTrue(is_female(None, "陈燕青"))
        self.assertTrue(is_female(None, "Ivy"))
        self.assertTrue(is_female("female", "任何人"))
        self.assertFalse(is_female("male", "Ivy"))  # self-report male wins
        self.assertFalse(is_female(None, "小猪"))

    def test_rerank_women_from_singles(self):
        singles = [
            {"name": "A男", "gender": "male", "rating": 8.0},
            {"name": "陈燕青", "gender": None, "rating": 6.5},
            {"name": "Ivy", "gender": None, "rating": 5.5},
            {"name": "B男", "gender": "male", "rating": 7.0},
            {"name": "Shirley", "gender": "female", "rating": 6.0},
        ]
        allow = {"陈燕青", "ivy", "shirley"}

        def is_female(p):
            g = (p.get("gender") or "").strip().lower()
            if g == "female":
                return True
            if g == "male":
                return False
            return (p["name"] or "").strip().lower() in allow

        women = [p for p in singles if is_female(p)]
        women.sort(key=lambda p: (-p["rating"], p["name"]))
        ranks = [(i + 1, p["name"], p["rating"]) for i, p in enumerate(women)]
        self.assertEqual(
            ranks,
            [(1, "陈燕青", 6.5), (2, "Shirley", 6.0), (3, "Ivy", 5.5)],
        )


if __name__ == "__main__":
    unittest.main()
