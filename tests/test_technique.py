"""Coach checklist, video-observable flags, and prompt wiring. No GPU."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np

from pipeline.analyze import infer_view, score_and_write, view_is_side, view_label
from pipeline.coach import _build_prompt, _pick_keyframes, _slim_report
from pipeline.pose import KPT
from pipeline.technique import extra_findings, flags_from_values, prompt_knowledge


class FlagTests(unittest.TestCase):
    def test_wipe_glass_when_high_takeback_does_not_drop(self):
        flags = flags_from_values(
            "forehand",
            slot_drop=0.02,
            takeback_height=0.22,
        )
        self.assertIn("wipe_glass", flags)

    def test_no_wipe_glass_when_racket_drops_into_slot(self):
        flags = flags_from_values(
            "forehand",
            slot_drop=0.12,
            takeback_height=0.22,
        )
        self.assertNotIn("wipe_glass", flags)

    def test_wipe_glass_skips_slice_and_backhand(self):
        kwargs = dict(slot_drop=0.01, takeback_height=0.25)
        self.assertNotIn("wipe_glass", flags_from_values("forehand_slice", **kwargs))
        self.assertNotIn("wipe_glass", flags_from_values("backhand", **kwargs))

    def test_arm_only_when_wrist_goes_back_without_turn(self):
        flags = flags_from_values("forehand", wrist_back=0.22, body_turn=0.01)
        self.assertIn("arm_only", flags)
        flags_ok = flags_from_values("forehand", wrist_back=0.22, body_turn=0.12)
        self.assertNotIn("arm_only", flags_ok)

    def test_weight_shift_only_on_side_view(self):
        self.assertIn(
            "no_weight_shift",
            flags_from_values("forehand", view="side", weight_shift=0.0),
        )
        self.assertNotIn(
            "no_weight_shift",
            flags_from_values("forehand", view="back", weight_shift=0.0),
        )

    def test_missing_numbers_do_not_invent_flags(self):
        self.assertEqual(flags_from_values("forehand"), [])

    def test_side_only_proxies_skip_back_view(self):
        kwargs = dict(slot_drop=0.01, takeback_height=0.25, wrist_back=0.22, body_turn=0.0)
        self.assertIn("wipe_glass", flags_from_values("forehand", view="side", **kwargs))
        back = flags_from_values("forehand", view="back", **kwargs)
        self.assertNotIn("wipe_glass", back)
        self.assertNotIn("arm_only", back)

    def test_hand_reach_skips_non_side(self):
        self.assertIn("hand_reach", flags_from_values("forehand", view="side", hand_reaches=True))
        self.assertNotIn("hand_reach", flags_from_values("forehand", view="back", hand_reaches=True))
        self.assertNotIn("hand_reach", flags_from_values("forehand", view="oblique", hand_reaches=True))


class FindingsTests(unittest.TestCase):
    def test_extra_findings_name_wipe_glass_drill(self):
        _s, problems, drills = extra_findings(
            "forehand",
            {"flag_rates": {"wipe_glass": 0.6}, "slot_drop": 0.02},
        )
        blob = " ".join(problems + drills)
        self.assertIn("擦玻璃", blob)
        self.assertIn("拍凳子", blob)

    def test_score_and_write_surfaces_coach_errors(self):
        base = score_and_write("forehand", {"n_swings": 8, "cog_ratio": 0.5, "flag_rates": {}})
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
        self.assertLess(written["scores"]["击球效果"], base["scores"]["击球效果"])
        self.assertLess(written["scores"]["动力链"], base["scores"]["动力链"])

    def test_non_side_does_not_name_technique_errors(self):
        written = score_and_write(
            "forehand",
            {
                "n_swings": 8,
                "cog_ratio": 0.5,
                "flag_rates": {"wipe_glass": 0.5, "arm_only": 0.5},
                "slot_drop": 0.02,
                "body_turn": 0.01,
            },
            view="back",
        )
        text = " ".join(written["problems"] + written["drills"] + written["strengths"])
        self.assertFalse(written["evaluable"])
        self.assertIn("正侧面", text)
        self.assertNotIn("擦玻璃", text)
        self.assertNotIn("拍凳子", text)

    def test_side_low_lift_does_not_call_it_slice(self):
        written = score_and_write(
            "forehand",
            {"n_swings": 6, "cog_ratio": 0.5, "path_lift": -0.2, "flag_rates": {}},
            view="side",
        )
        blob = " ".join(written["problems"] + written["drills"] + written["strengths"])
        self.assertTrue(written["evaluable"])
        self.assertNotIn("正手切削", blob)
        self.assertNotIn("单独按切削练", blob)


class PromptTests(unittest.TestCase):
    def test_knowledge_covers_forehand_and_limits(self):
        text = prompt_knowledge(["forehand"], "right")
        self.assertIn("拍凳子", text)
        self.assertIn("擦玻璃", text)
        self.assertIn("左肩", text)
        self.assertIn("不要编 6:00", text)
        self.assertIn("只评正侧面", text)
        self.assertIn("不要判断切削、截击", text)
        self.assertNotIn("截击正手", text)
        self.assertNotIn("高压：", text)

    def test_lefty_swaps_front_shoulder(self):
        text = prompt_knowledge(["forehand"], "left")
        self.assertIn("右肩对准来球", text)

    def test_build_prompt_includes_checklist_and_hints(self):
        report = {
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
                        "problems": ["擦玻璃：引拍后没有由高往低落入击球槽"],
                    },
                    "summary": {
                        "n_swings": 6,
                        "flag_rates": {"wipe_glass": 0.5},
                        "slot_drop": 0.02,
                    },
                    "swings": [
                        {
                            "index": 1,
                            "contact_t": 1.2,
                            "shot_kind": "topspin",
                            "tech_flags": ["wipe_glass"],
                            "flag_notes": ["擦玻璃倾向"],
                            "slot_drop": 0.02,
                        }
                    ],
                }
            ],
            "overall": {"shot_mix": {"forehand": 6}},
        }
        prompt = _build_prompt(report, ["底线正手 挥拍#1 引拍 t=1.2"])
        self.assertIn("拍凳子", prompt)
        self.assertIn("不要把任何一拍写成切削", prompt)
        self.assertIn("rule_hints", prompt)
        self.assertIn("wipe_glass", prompt)
        slim = _slim_report(report)
        self.assertEqual(slim["clips"][0]["rule_hints"]["problems"][0][:3], "擦玻璃")
        self.assertEqual(slim["clips"][0]["swings"][0]["tech_flags"], ["wipe_glass"])

    def test_pick_keyframes_prefers_full_cycle(self):
        with tempfile.TemporaryDirectory() as raw:
            d = Path(raw)
            for name in (
                "forehand_s01_takeback.jpg",
                "forehand_s01_contact.jpg",
                "forehand_s01_follow.jpg",
                "forehand_s01_ready.jpg",
            ):
                (d / name).write_bytes(b"x" * 20)
            clips = [
                {
                    "label": "底线正手",
                    "swings": [
                        {
                            "index": 1,
                            "contact_t": 2.0,
                            "phases": {
                                "ready": {"oss_key": "forehand_s01_ready.jpg"},
                                "takeback": {"oss_key": "forehand_s01_takeback.jpg"},
                                "contact": {"oss_key": "forehand_s01_contact.jpg"},
                                "follow": {"oss_key": "forehand_s01_follow.jpg"},
                            },
                        }
                    ],
                }
            ]
            picks = _pick_keyframes(clips, d, limit=5)
            labels = [lab for lab, _ in picks]
            self.assertGreaterEqual(len(picks), 4)
            self.assertTrue(any("引拍" in lab for lab in labels))
            self.assertTrue(any("随挥" in lab for lab in labels))
            self.assertTrue(any("准备" in lab for lab in labels))


class ViewTests(unittest.TestCase):
    def _frames(self, shoulder_width: float, torso=100.0, n=5):
        xy_list, conf_list = [], []
        for _ in range(n):
            xy = np.zeros((17, 2), dtype=np.float64)
            conf = np.ones(17, dtype=np.float64)
            xy[KPT["l_shoulder"]] = [0.0, 0.0]
            xy[KPT["r_shoulder"]] = [shoulder_width, 0.0]
            xy[KPT["l_hip"]] = [shoulder_width / 2, torso]
            xy[KPT["r_hip"]] = [shoulder_width / 2, torso]
            xy_list.append(xy)
            conf_list.append(conf)
        return xy_list, conf_list

    def test_true_profile_is_side(self):
        xy, conf = self._frames(20)
        self.assertEqual(infer_view(xy, conf), "side")
        self.assertTrue(view_is_side("side"))

    def test_three_quarter_is_oblique_not_evaluated(self):
        xy, conf = self._frames(36)
        self.assertEqual(infer_view(xy, conf), "oblique")
        self.assertEqual(view_label("oblique"), "斜切")
        self.assertFalse(view_is_side("oblique"))

    def test_facing_camera_is_back(self):
        xy, conf = self._frames(55)
        self.assertEqual(infer_view(xy, conf), "back")
        self.assertEqual(view_label("back"), "背面")


if __name__ == "__main__":
    unittest.main()
