"""ZQ-159: repo kit mirrors prod onboard 四卖点 (涨球乐); not 动作."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "deploy/login-intro-restore/opt-patch/lib/i18n/messages.ts"
LEGACY = ROOT / "deploy/login-intro-restore/opt-patch/lib/messages.ts"
ONBOARDING = ROOT / "deploy/login-intro-restore/opt-patch/components/onboarding.tsx"
LOGIN_VIEW = ROOT / "deploy/login-intro-restore/opt-patch/components/login-view.tsx"
APPLY = ROOT / "deploy/login-intro-restore/scripts/apply-on-server.sh"
LOGIN_WXML = ROOT / "miniprogram/pages/login/login.wxml"
LOGIN_JS = ROOT / "miniprogram/pages/login/login.js"


class LoginIntroRestoreTests(unittest.TestCase):
    def test_kit_files_exist(self):
        for path in (I18N, LEGACY, ONBOARDING, LOGIN_VIEW, APPLY):
            self.assertTrue(path.is_file(), path)

    def test_apply_refuses_without_force(self):
        text = APPLY.read_text(encoding="utf-8")
        self.assertIn("FORCE_ZQ159_APPLY", text)
        self.assertIn("bc-b415e8ef", text)

    def test_zh_onboard_matches_live_prod(self):
        text = I18N.read_text(encoding="utf-8")
        self.assertIn('title: "欢迎来到涨球乐"', text)
        self.assertIn(
            "多打球、约对手、看排名、找教练——让我们大家一起涨球。",
            text,
        )
        self.assertIn('level: "一起涨球"', text)
        self.assertIn('score: "约到水平相当的球友"', text)
        self.assertIn('analyze: "赛后看排名变化"', text)
        self.assertIn('history: "AI 教练与真实网络教练"', text)
        self.assertIn(
            "日常训练有疑问，可获 AI 教练与真实网络教练指导。",
            text,
        )
        zh_onboard = text.split('title: "欢迎来到涨球乐"')[1].split("lang:")[0]
        self.assertNotIn("先选技术动作", zh_onboard)
        self.assertNotIn("每个动作的分数", zh_onboard)
        self.assertNotIn("历史报告", zh_onboard)

    def test_en_onboard_matches_live_prod(self):
        text = I18N.read_text(encoding="utf-8")
        en_block = text.split("onboard:")[1].split("lang:")[0]
        self.assertIn("Welcome to 涨球乐", en_block)
        self.assertIn("See ranking changes after matches", en_block)
        self.assertIn("AI coach and real network coaches", en_block)
        self.assertNotIn("Pick a stroke", en_block)

    def test_login_view_mounts_onboarding(self):
        text = LOGIN_VIEW.read_text(encoding="utf-8")
        self.assertIn('import { Onboarding } from "@/components/onboarding"', text)
        self.assertIn("<Onboarding />", text)

    def test_mp_wechat_one_tap_preserved_from_zq158(self):
        """Do not fight ZQ-158 / Mac lock: WeChat tab stays one-tap."""
        wxml = LOGIN_WXML.read_text(encoding="utf-8")
        js = LOGIN_JS.read_text(encoding="utf-8")
        self.assertIn("微信登录", wxml)
        self.assertNotIn('type="nickname"', wxml)
        self.assertNotIn("显示名", wxml)
        self.assertIn("wechatLogin({ code })", js)


if __name__ == "__main__":
    unittest.main()
