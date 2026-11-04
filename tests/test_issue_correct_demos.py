"""Issue findings / low scores → correct-action demo mapping (涨球)."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TS = ROOT / "deploy/correct-video-by-issues/opt-patch/lib/issue-correct-demos.ts"
VC = ROOT / "deploy/correct-video-by-issues/opt-patch/components/visual-coach.tsx"

ISSUE_RULES = [
    (re.compile(r"重心|直腿|站得|头肩|weight|straight leg|cog_high|cog_unstable", re.I), "weight", "重心"),
    (re.compile(r"步幅偏窄|开立不够|两脚太近|站位|stance too narrow|feet too close|stance_narrow", re.I), "stance", "重心"),
    (re.compile(r"击球点.*晚|太后|偏晚|contact late|too far back|late_contact|挤在|贴在", re.I), "late", "击球点"),
    (re.compile(r"击球点.*低|最高点|contact too low|contact_low|peak", re.I), "contact_low", "击球点"),
    (re.compile(r"击球点.*高|contact_high|contact too high", re.I), "contact_high", "击球点"),
    (re.compile(r"够不着|伸手|hand_reach|reach", re.I), "reach", "击球点"),
    (re.compile(r"转肩|转髋|动力链|只动手|肩髋|shoulder turn|kinetic chain|chain_break", re.I), "turn", "动力链"),
    (re.compile(r"拍没落|后摆偏浅|后口袋|引拍|racket head not dropped|late takeback|takeback_shallow", re.I), "takeback", "动力链"),
    (re.compile(r"提前迈步|early_step|both_feet_off|双脚离地", re.I), "step", "动力链"),
    (re.compile(r"拍头偏慢|速度偏慢|speed_slow|擦玻璃|path_flat|随挥|follow-?through|出球发飘", re.I), "effect", "击球效果"),
]

AXIS_LOW = {"重心": 18, "击球点": 14, "动力链": 20, "击球效果": 18}
AXIS_KEY = {"重心": "balance", "击球点": "contact", "动力链": "chain", "击球效果": "effect"}


def detect_issue_ids(findings: list[str], scores: dict[str, float] | None = None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    axes_hit: set[str] = set()
    for line in findings:
        for rule, issue_id, axis in ISSUE_RULES:
            if rule.search(line) and issue_id not in seen:
                seen.add(issue_id)
                axes_hit.add(axis)
                out.append(issue_id)
    if scores:
        for axis, low in AXIS_LOW.items():
            if axis in axes_hit:
                continue
            score = scores.get(axis)
            if score is None:
                score = scores.get(AXIS_KEY[axis])  # type: ignore[arg-type]
            if score is None or score > low:
                continue
            aid = f"axis-{AXIS_KEY[axis]}"
            if aid not in seen:
                seen.add(aid)
                out.append(aid)
    return out[:4]


class IssueCorrectDemosTests(unittest.TestCase):
    def test_ts_module_exists(self):
        self.assertTrue(TS.is_file(), TS)
        text = TS.read_text(encoding="utf-8")
        self.assertIn("detectIssuePoints", text)
        self.assertIn("resolveIssueCorrectDemos", text)
        self.assertIn("涨球", text)
        self.assertIn("/tennis/examples/", text)
        self.assertIn('source !== "coach"', text)

    def test_findings_map_to_contact_and_chain(self):
        ids = detect_issue_ids(["击球点偏晚，球挤在身体旁边", "动力链断裂，只动手发力"])
        self.assertEqual(ids, ["late", "turn"])

    def test_en_findings(self):
        ids = detect_issue_ids(["Contact late — meet the ball farther in front.", "Not enough shoulder turn"])
        self.assertIn("late", ids)
        self.assertIn("turn", ids)

    def test_low_scores_without_findings(self):
        ids = detect_issue_ids([], {"重心": 12, "击球点": 18, "动力链": 28, "击球效果": 22})
        self.assertEqual(ids, ["axis-balance"])

    def test_findings_and_scores_dedupe_axis(self):
        ids = detect_issue_ids(["重心偏高，准备时腿是直的"], {"重心": 10, "击球点": 16, "动力链": 22, "击球效果": 20})
        self.assertEqual(ids, ["weight"])
        self.assertNotIn("axis-balance", ids)

    def test_cap_four(self):
        ids = detect_issue_ids(
            [
                "重心偏高",
                "击球点偏晚",
                "动力链断裂",
                "拍头偏慢",
                "引拍偏浅",
                "站位偏窄",
            ]
        )
        self.assertEqual(len(ids), 4)

    def test_visual_coach_wires_issue_demos(self):
        text = VC.read_text(encoding="utf-8")
        self.assertIn("resolveIssueCorrectDemos", text)
        self.assertIn("data-issue-demos", text)
        self.assertIn("data-issue-axis", text)
        self.assertIn("visual.correctByIssuesLead", text)
        self.assertIn("demoLoading", text)
        self.assertIn("demoError", text)


if __name__ == "__main__":
    unittest.main()
