"""Resolution rules: stars default; coach only when selected + has video."""

from __future__ import annotations

import unittest


def is_playable_coach_url(url: str | None) -> bool:
    u = (url or "").strip()
    if not u:
        return False
    if "/tennis/examples/" in u:
        return False
    return u.startswith(("http://", "https://", "blob:", "/tennis/coach-demos/"))


def resolve(stroke: str, coach: dict | None) -> dict:
    stars = {
        "fh-topspin": ("阿里娜·萨巴伦卡", "https://player.bilibili.com/player.html?bvid=BV1knqeB4EpG&high_quality=1"),
        "bh-topspin": ("诺瓦克·德约科维奇", "https://player.bilibili.com/player.html?bvid=BV1Gy4y1a7zj&high_quality=1"),
        "serve": ("皮特·桑普拉斯", "https://player.bilibili.com/player.html?bvid=BV13t411K7Kw&high_quality=1"),
    }
    name, embed = stars.get(stroke, stars["fh-topspin"])
    use_coach = bool(coach and coach.get("selectedPublished") and is_playable_coach_url(coach.get("videoUrl")))
    if use_coach:
        return {"source": "coach", "credit": coach["coachName"], "embed": coach["videoUrl"]}
    return {"source": "star", "credit": name, "embed": embed}


class PlatformDemoResolveTests(unittest.TestCase):
    def test_default_is_sabalenka_not_examples_mp4(self) -> None:
        r = resolve("fh-topspin", None)
        self.assertEqual(r["source"], "star")
        self.assertIn("萨巴伦卡", r["credit"])
        self.assertIn("bilibili.com", r["embed"])
        self.assertNotIn("/tennis/examples/", r["embed"])

    def test_muddy_examples_url_rejected_even_if_marked_selected(self) -> None:
        r = resolve(
            "fh-topspin",
            {
                "selectedPublished": True,
                "coachName": "某教练",
                "videoUrl": "https://yqchen.blog/tennis/examples/forehand-topspin.mp4",
            },
        )
        self.assertEqual(r["source"], "star")

    def test_published_coach_library_wins(self) -> None:
        r = resolve(
            "fh-topspin",
            {
                "selectedPublished": True,
                "coachName": "风格A教练",
                "videoUrl": "/tennis/coach-demos/fh.mp4",
            },
        )
        self.assertEqual(r["source"], "coach")
        self.assertEqual(r["credit"], "风格A教练")

    def test_unselected_coach_library_ignored(self) -> None:
        r = resolve(
            "bh-topspin",
            {
                "selectedPublished": False,
                "coachName": "风格A教练",
                "videoUrl": "/tennis/coach-demos/bh.mp4",
            },
        )
        self.assertEqual(r["source"], "star")
        self.assertIn("德约", r["credit"])


if __name__ == "__main__":
    unittest.main()
