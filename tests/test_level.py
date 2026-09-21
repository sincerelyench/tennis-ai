"""Player-declared NTRP level: parsing, copy, and prompt wiring. No GPU."""

from __future__ import annotations

import unittest

from pipeline.analyze import score_and_write
from pipeline.coach import _build_prompt, _slim_report
from pipeline.level import issue_text, parse_level, prompt_level_block, public_levels
from pipeline.technique import extra_findings, prompt_knowledge


class ParseLevelTests(unittest.TestCase):
    def test_default_and_aliases(self):
        self.assertEqual(parse_level(None).code, "3.0")
        self.assertEqual(parse_level("").code, "3.0")
        self.assertEqual(parse_level("3.5 中级").code, "3.5")
        self.assertEqual(parse_level(4).code, "4.0")
        self.assertEqual(parse_level("5.0+").code, "5.0")
        self.assertEqual(parse_level("1.0").code, "2.0")
        self.assertEqual(parse_level("9").code, "5.0")
        self.assertEqual(parse_level("ntrp2.5").ntrp, 2.5)

    def test_catalog(self):
        codes = [item["code"] for item in public_levels()]
        self.assertEqual(codes, ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"])
        self.assertEqual(parse_level("3.0").label, "3.0 进阶初级")


class IssueCopyTests(unittest.TestCase):
    def test_late_contact_differs_between_2_and_5(self):
        p2, d2 = issue_text("late_contact", "2.0", late_pct=60)
        p5, d5 = issue_text("late_contact", "5.0", late_pct=60)
        self.assertIn("等球", p2)
        self.assertIn("自抛", d2)
        self.assertIn("间距", p5)
        self.assertNotIn("还不会打身前", p5)
        self.assertNotIn("等球", p5)
        self.assertNotIn("自抛", d5)
        self.assertIn("压缩", d5)
        self.assertNotEqual(p2, p5)

    def test_wipe_glass_default_keeps_old_words(self):
        p, d = issue_text("wipe_glass", "3.0")
        self.assertIn("擦玻璃", p)
        self.assertIn("拍凳子", d)

    def test_wipe_glass_beginner_avoids_jargon_pile(self):
        p, d = issue_text("wipe_glass", "2.0")
        self.assertIn("从低往高", p + d)
        self.assertNotIn("伤病", p + d)

    def test_five_oh_forbids_bench_drill(self):
        _p, d = issue_text("cog_high", "5.0")
        self.assertNotIn("坐凳", d)
        self.assertIn("被动球", d)


class FindingsAndScoreTests(unittest.TestCase):
    def test_extra_findings_level_changes_arm_only(self):
        summary = {"flag_rates": {"arm_only": 0.6}, "body_turn": 0.01}
        _s2, p2, d2 = extra_findings("forehand", summary, player_level="2.0")
        _s5, p5, d5 = extra_findings("forehand", summary, player_level="5.0")
        blob2 = " ".join(p2 + d2)
        blob5 = " ".join(p5 + d5)
        self.assertIn("转肩", blob2)
        self.assertIn("画面", blob5)
        self.assertNotIn("伤病", blob2)

    def test_score_late_contact_copy_by_level(self):
        summary = {
            "n_swings": 8,
            "cog_ratio": 0.5,
            "late_contact_rate": 0.6,
            "contact_forward": 0.02,
            "flag_rates": {},
        }
        low = score_and_write("forehand", summary, player_level="2.0")
        high = score_and_write("forehand", summary, player_level="5.0")
        low_text = " ".join(low["problems"] + low["drills"])
        high_text = " ".join(high["problems"] + high["drills"])
        self.assertIn("等球", low_text)
        self.assertIn("间距", high_text)
        self.assertNotIn("还不会打身前", high_text)
        self.assertNotIn("等球", high_text)
        self.assertEqual(low["scores"]["综合"], high["scores"]["综合"])

    def test_default_level_still_names_wipe_glass(self):
        written = score_and_write(
            "forehand",
            {
                "n_swings": 8,
                "cog_ratio": 0.5,
                "flag_rates": {"wipe_glass": 0.5, "arm_only": 0.5},
                "slot_drop": 0.02,
                "body_turn": 0.01,
            },
        )
        text = " ".join(written["problems"] + written["drills"])
        self.assertIn("擦玻璃", text)
        self.assertIn("只动手不转体", text)
        self.assertTrue(any("3.0" in c for c in written["caveats"]))


class PromptTests(unittest.TestCase):
    def _report(self, level="3.5"):
        return {
            "player_level": level,
            "player_level_label": parse_level(level).label,
            "handedness": "right",
            "handedness_label": "右手持拍",
            "view_label": "侧面",
            "clips": [
                {
                    "id": "forehand",
                    "label": "底线正手",
                    "hitting_arm": "right",
                    "scores": {"综合": 70, "重心": 18, "击球点": 14, "动力链": 20, "击球效果": 18},
                    "analysis": {
                        "strengths": ["引拍完整"],
                        "problems": ["击球点偏晚"],
                    },
                    "summary": {"n_swings": 6, "late_contact_rate": 0.5},
                    "swings": [{"index": 1, "contact_t": 1.2, "late_contact": True}],
                }
            ],
            "overall": {"shot_mix": {"forehand": 6}},
        }

    def test_prompt_names_declared_level_and_forbids_reestimate(self):
        prompt = _build_prompt(self._report("5.0"), ["底线正手 挥拍#1"])
        self.assertIn("5.0 准专业", prompt)
        self.assertIn("不要另估", prompt)
        self.assertIn("间距/提前量", prompt)
        self.assertIn("禁止写「还不会打身前」", prompt)
        slim = _slim_report(self._report("5.0"))
        self.assertEqual(slim["player_level"], "5.0")

    def test_two_oh_prompt_forbids_kinetic_jargon(self):
        text = prompt_level_block("2.0")
        self.assertIn("禁用「动力链」", text)
        self.assertIn("自抛自打", text)

    def test_knowledge_starts_with_level(self):
        text = prompt_knowledge(["forehand"], "right", player_level="4.0")
        self.assertIn("4.0 中高级", text)
        self.assertIn("拍凳子", text)
        self.assertLess(text.find("球员自评等级"), text.find("底线正手"))


if __name__ == "__main__":
    unittest.main()
