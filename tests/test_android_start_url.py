"""Android shell must default to the live web product URL."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRADLE = ROOT / "android" / "app" / "build.gradle"
MAIN = ROOT / "android" / "app" / "src" / "main" / "java" / "app" / "zhangqiu" / "MainActivity.java"
WEB = "https://yqchen.blog/tennis"
LEGACY = "sslip.io/e1"


class AndroidStartUrlTests(unittest.TestCase):
    def test_gradle_default_is_web(self):
        text = GRADLE.read_text(encoding="utf-8")
        self.assertIn(WEB, text)
        self.assertNotIn(LEGACY, text)
        m = re.search(r'\?:\s*"([^"]+)"', text)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), WEB)

    def test_main_activity_loads_start_url_resource(self):
        java = MAIN.read_text(encoding="utf-8")
        self.assertIn("getString(R.string.start_url)", java)
        self.assertIn("webView.loadUrl(startUrl)", java)
        self.assertIn("ZhangqiuAndroid/1", java)
        self.assertIn("yqchen.blog/tennis", java)


if __name__ == "__main__":
    unittest.main()
