"""Platform star demo catalog — no muddy coach examples as default."""

from __future__ import annotations

import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAR_TS = ROOT / "deploy/restore-star-demos/opt-patch/lib/star-demos.ts"
PLATFORM_TS = ROOT / "deploy/restore-star-demos/opt-patch/lib/platform-demo.ts"
HOOK_TS = ROOT / "deploy/restore-star-demos/opt-patch/lib/coach-library-analysis-hook.ts"
MP_JS = ROOT / "miniprogram/utils/star-demos.js"


class StarDemoCatalogTests(unittest.TestCase):
    def test_star_ts_covers_eight_strokes_with_bilibili_or_youtube(self) -> None:
        text = STAR_TS.read_text(encoding="utf-8")
        for stroke in (
            "fh-topspin",
            "fh-slice",
            "fh-volley",
            "bh-topspin",
            "bh-slice",
            "bh-volley",
            "serve",
            "smash",
        ):
            self.assertIn(f'"{stroke}"', text)
        self.assertIn("BV1knqeB4EpG", text)  # Sabalenka
        self.assertIn("BV1Gy4y1a7zj", text)  # Djokovic
        self.assertIn("BZEAu4L3WzQ", text)
        self.assertIn("high_quality=1", text)
        # Catalog must not assign /tennis/examples as a playable source.
        self.assertNotRegex(text, r'embedUrl:[^\n]*/tennis/examples/')
        self.assertNotRegex(text, r'watchUrl:[^\n]*/tennis/examples/')
        self.assertIn("Do NOT point at /tennis/examples/", text)

    def test_platform_rules_mention_selected_published_only(self) -> None:
        text = PLATFORM_TS.read_text(encoding="utf-8")
        self.assertIn("selectedPublished", text)
        self.assertIn("/tennis/examples/", text)  # explicitly rejected
        self.assertIn("涨球教练", text)
        self.assertNotIn("掌球教练", text)

    def test_hook_defaults_to_stars(self) -> None:
        text = HOOK_TS.read_text(encoding="utf-8")
        self.assertIn("涨球教练", text)
        self.assertIn("selectedPublished", text)
        self.assertIn("platformStarDemoSync", text)
        # May mention 掌球 only as a banned/legacy string to strip.
        self.assertIn("never 掌球", text)
        self.assertRegex(text, r"replace\(/Poppy\|东东\|Dongdong\|掌球教练/")

    def test_miniprogram_helper_exports_sabalenka(self) -> None:
        spec = importlib.util.spec_from_loader("star_demos_mp", loader=None)
        # Load via node-less exec of CommonJS-ish by rewriting
        raw = MP_JS.read_text(encoding="utf-8")
        self.assertIn("BV1knqeB4EpG", raw)
        self.assertIn("阿里娜·萨巴伦卡", raw)
        self.assertTrue(re.search(r"module\.exports\s*=", raw))


if __name__ == "__main__":
    unittest.main()
