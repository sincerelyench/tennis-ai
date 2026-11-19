"""ZQ-159: login-page product intro = 涨球乐 四卖点 (not 动作); shown before login."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "deploy/login-intro-restore/opt-patch/lib/i18n/messages.ts"
LEGACY = ROOT / "deploy/login-intro-restore/opt-patch/lib/messages.ts"
ONBOARDING = ROOT / "deploy/login-intro-restore/opt-patch/components/onboarding.tsx"
LOGIN_VIEW = ROOT / "deploy/login-intro-restore/opt-patch/components/login-view.tsx"
LOGIN_WXML = ROOT / "miniprogram/pages/login/login.wxml"
LOGIN_JS = ROOT / "miniprogram/pages/login/login.js"
WEB_JS = ROOT / "miniprogram/pages/web/web.js"


class LoginIntroRestoreTests(unittest.TestCase):
    def test_kit_files_exist(self):
        for path in (I18N, LEGACY, ONBOARDING, LOGIN_VIEW, LOGIN_WXML, LOGIN_JS, WEB_JS):
            self.assertTrue(path.is_file(), path)

    def test_zh_onboard_is_four_selling_points_not_stroke(self):
        text = I18N.read_text(encoding="utf-8")
        self.assertIn('title: "欢迎来到涨球乐"', text)
        self.assertIn("多打球、约对手、看排名、找教练——让我们大家一起涨球乐。", text)
        self.assertIn('level: "一起涨球"', text)
        self.assertIn('score: "约到水平相当的球友"', text)
        self.assertIn('analyze: "赛后看排名变化"', text)
        self.assertIn('history: "AI 教练与真实网络教练"', text)
        zh_onboard = text.split('title: "欢迎来到涨球乐"')[1].split("lang:")[0]
        self.assertNotIn("先选技术动作", zh_onboard)
        self.assertNotIn("每个动作的分数", zh_onboard)
        self.assertNotIn("历史报告", zh_onboard)

    def test_en_onboard_matches_product_pitch(self):
        text = I18N.read_text(encoding="utf-8")
        en_block = text.split("onboard:")[1].split("lang:")[0]
        self.assertIn("Welcome to 涨球乐", en_block)
        self.assertIn("Find local rivals near your level", en_block)
        self.assertIn("AI coach & real network coaches", en_block)
        self.assertNotIn("Pick a stroke", en_block)

    def test_login_view_mounts_onboarding(self):
        text = LOGIN_VIEW.read_text(encoding="utf-8")
        self.assertIn('import { Onboarding } from "@/components/onboarding"', text)
        self.assertIn("<Onboarding />", text)

    def test_onboarding_honors_mp_skip_flag(self):
        text = ONBOARDING.read_text(encoding="utf-8")
        self.assertIn('STORAGE_KEY = "tennis-onboarded"', text)
        self.assertIn('zq_onboarded', text)

    def test_mp_login_hosts_intro_modal(self):
        wxml = LOGIN_WXML.read_text(encoding="utf-8")
        js = LOGIN_JS.read_text(encoding="utf-8")
        self.assertIn("欢迎来到涨球乐", wxml)
        self.assertIn("多打球、约对手、看排名、找教练", wxml)
        self.assertIn("showOnboard", wxml)
        self.assertIn("onboardPoints", wxml)
        self.assertIn("dismissOnboard", js)
        self.assertIn('ONBOARD_KEY = "tennis-onboarded"', js)
        self.assertIn("一起涨球", js)
        self.assertIn("约到水平相当的球友", js)
        self.assertIn("赛后看排名变化", js)
        self.assertIn("AI 教练与真实网络教练", js)
        self.assertNotIn("先选技术动作", wxml + js)

    def test_mp_webview_passes_onboarded_flag(self):
        text = WEB_JS.read_text(encoding="utf-8")
        self.assertIn("zq_onboarded=1", text)
        self.assertIn("onboarded", text)


if __name__ == "__main__":
    unittest.main()
