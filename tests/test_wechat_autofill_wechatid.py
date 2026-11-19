"""ZQ-157/158: wechatId ≠ openid; WeChat login is one-tap (no displayName on login)."""

from __future__ import annotations

import hashlib
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH_STORE = ROOT / "deploy/wechat-autofill-wechatid/opt-patch/lib/auth-store.ts"
WECHAT_ROUTE = ROOT / "deploy/wechat-autofill-wechatid/opt-patch/app/api/auth/wechat/route.ts"
SESSION_JS = ROOT / "miniprogram/utils/session.js"
API_JS = ROOT / "miniprogram/utils/api.js"
LOGIN_WXML = ROOT / "miniprogram/pages/login/login.wxml"
LOGIN_JS = ROOT / "miniprogram/pages/login/login.js"
PROFILE_WXML = ROOT / "miniprogram/pages/profile-setup/profile-setup.wxml"
PROFILE_JS = ROOT / "miniprogram/pages/profile-setup/profile-setup.js"
APP_JSON = ROOT / "miniprogram/app.json"


def sanitize_wechat_id(raw: str | None) -> str:
    id_ = re.sub(r"\s+", "", str(raw or "").strip())[:32]
    if not id_:
        return ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{3,32}", id_):
        return ""
    return id_


def wechat_id_from_openid(openid: str | None) -> str:
    """Legacy ZQ-149/151 derivation — used only to detect pollution."""
    oid = str(openid or "").strip()
    if not oid or len(oid) < 8 or len(oid) > 128:
        return ""
    direct = sanitize_wechat_id(oid)
    if direct:
        return direct
    hex_ = hashlib.sha256(f"wxid:{oid}".encode()).hexdigest()
    return sanitize_wechat_id("w" + hex_[:31])


def is_openid_derived(wechat_id: str | None, openid: str | None) -> bool:
    id_ = sanitize_wechat_id(wechat_id)
    if not id_:
        return False
    derived = wechat_id_from_openid(openid)
    return bool(derived) and id_ == derived


def effective_wechat_id(wechat_id: str | None, openid: str | None) -> str:
    id_ = sanitize_wechat_id(wechat_id)
    if not id_ or is_openid_derived(id_, openid):
        return ""
    return id_


def wechat_contact_satisfied(wechat_id: str | None, openid: str | None) -> bool:
    return bool(effective_wechat_id(wechat_id, openid))


def is_blank_or_placeholder_display_name(raw: str | None) -> bool:
    name = str(raw or "").strip()[:40]
    if not name:
        return True
    if re.fullmatch(r"(微信用户|微信昵称|wechat\s*user|wx\s*user|user)", name, flags=re.I):
        return True
    return False


class WechatIdNotOpenidTests(unittest.TestCase):
    def test_kit_files_exist(self):
        self.assertTrue(AUTH_STORE.is_file(), AUTH_STORE)
        self.assertTrue(WECHAT_ROUTE.is_file(), WECHAT_ROUTE)
        self.assertTrue(SESSION_JS.is_file(), SESSION_JS)

    def test_auth_store_stops_openid_autofill(self):
        text = AUTH_STORE.read_text(encoding="utf-8")
        self.assertIn("export function wechatIdFromOpenid", text)
        self.assertIn("export function isOpenidDerivedWechatId", text)
        self.assertIn("export function effectiveWechatId", text)
        self.assertIn("export function wechatContactSatisfied", text)
        self.assertIn("export function isBlankOrPlaceholderDisplayName", text)
        self.assertIn("ZQ-157", text)
        # Must not autofill or lazy-backfill openid into wechatId
        self.assertNotIn("auto-fill 微信号", text)
        self.assertNotIn("Lazy backfill", text)
        self.assertIn("delete db.users[phone].wechatId", text)
        self.assertIn("isOpenidDerivedWechatId", text)
        # nickName must not be assigned to wechatId
        self.assertNotRegex(
            text,
            r"wechatId\s*=\s*.*nick",
            "nickName must not be used as wechatId",
        )
        # displayName defaults from nick when blank/placeholder
        self.assertIn("isBlankOrPlaceholderDisplayName(db.users[phone].displayName)", text)
        self.assertIn("db.users[phone].displayName = nick", text)
        # Contact gate must use effectiveWechatId (not openid length)
        self.assertIn("return !!effectiveWechatId(user)", text)
        self.assertNotRegex(
            text,
            r"wechatContactSatisfied[\s\S]{0,200}oid\.length\s*>=\s*8",
            "openid binding alone must not satisfy wechat contact",
        )

    def test_wechat_route_documents_empty_wechat_id(self):
        text = WECHAT_ROUTE.read_text(encoding="utf-8")
        self.assertIn("wechatId: result.wechatId", text)
        self.assertIn("needsProfileSetup", text)
        self.assertIn("displayName: result.displayName", text)
        self.assertIn("ZQ-157", text)
        self.assertIn("Do NOT write openid", text)

    def test_mp_session_stores_wechat_id_and_display_name(self):
        text = SESSION_JS.read_text(encoding="utf-8")
        self.assertIn("wechatId: payload.wechatId", text)
        self.assertIn("displayName: payload.displayName", text)
        self.assertIn("ZQ-157", text)
        self.assertNotIn("autofills wechatId from openid", text)

    def test_openid_must_not_count_as_wechat_id(self):
        openid = "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"
        self.assertEqual(wechat_id_from_openid(openid), openid)
        self.assertTrue(is_openid_derived(openid, openid))
        self.assertEqual(effective_wechat_id(openid, openid), "")
        self.assertFalse(wechat_contact_satisfied(openid, openid))
        self.assertFalse(wechat_contact_satisfied("", openid))
        self.assertFalse(wechat_contact_satisfied("", ""))

    def test_custom_wechat_id_kept(self):
        openid = "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"
        self.assertEqual(effective_wechat_id("my_wechat_id", openid), "my_wechat_id")
        self.assertTrue(wechat_contact_satisfied("my_wechat_id", openid))
        self.assertFalse(is_openid_derived("my_wechat_id", openid))

    def test_mock_openid_pollution_detected(self):
        openid = "mock_" + "a" * 24
        self.assertEqual(wechat_id_from_openid(openid), openid)
        self.assertEqual(effective_wechat_id(openid, openid), "")

    def test_odd_charset_openid_hash_pollution_detected(self):
        openid = "openid.with@odd.chars!!"
        got = wechat_id_from_openid(openid)
        self.assertTrue(got.startswith("w"))
        self.assertEqual(len(got), 32)
        self.assertEqual(effective_wechat_id(got, openid), "")

    def test_placeholder_display_name_detected(self):
        self.assertTrue(is_blank_or_placeholder_display_name(""))
        self.assertTrue(is_blank_or_placeholder_display_name("微信用户"))
        self.assertTrue(is_blank_or_placeholder_display_name("WeChat User"))
        self.assertFalse(is_blank_or_placeholder_display_name("陈燕青"))
        self.assertFalse(is_blank_or_placeholder_display_name("Ivy"))


class WechatOneTapLoginTests(unittest.TestCase):
    """ZQ-158: WeChat tab = one tap; nick picker on profile-setup."""

    def test_login_brand_is_zhangqiule(self):
        wxml = LOGIN_WXML.read_text(encoding="utf-8")
        self.assertIn("涨球乐", wxml)
        self.assertNotIn(">涨球<", wxml)

    def test_login_strips_inline_intro_copy(self):
        wxml = LOGIN_WXML.read_text(encoding="utf-8")
        self.assertNotIn('class="lead"', wxml)
        self.assertNotIn("登录后进入与网页同源", wxml)
        self.assertNotIn("登录后微信号自动写入", wxml)
        # ZQ-159 owns product intro modal — this PR must not invent one.
        self.assertNotIn("一起涨球", wxml)
        self.assertNotIn("data-onboarding", wxml)

    def test_wechat_tab_has_no_displayname_field(self):
        wxml = LOGIN_WXML.read_text(encoding="utf-8")
        login_js = LOGIN_JS.read_text(encoding="utf-8")
        self.assertIn("微信登录", wxml)
        # WeChat card must be button-only (no nickname / display-name input).
        m = re.search(
            r"wx:if=\"\{\{mode === 'wechat'\}\}\">([\s\S]*?)</view>\s*"
            r"<view class=\"card\" wx:if=\"\{\{mode === 'password'\}\}\"",
            wxml,
        )
        self.assertIsNotNone(m, "wechat card block not found")
        wechat_card = m.group(1)
        self.assertIn("onWechatLogin", wechat_card)
        self.assertNotIn("显示名", wechat_card)
        self.assertNotIn('type="nickname"', wechat_card)
        self.assertNotIn("<input", wechat_card)
        self.assertNotIn("onNickInput", login_js)
        self.assertNotIn("nickName:", login_js)
        # One-tap: wechatLogin({ code }) only
        self.assertIn("wechatLogin({ code })", login_js)
        self.assertIn("needsProfileSetup", login_js)
        self.assertIn("profile-setup", login_js)

    def test_password_and_phone_tabs_keep_fields(self):
        wxml = LOGIN_WXML.read_text(encoding="utf-8")
        self.assertIn("账号密码", wxml)
        self.assertIn("手机验证码", wxml)
        self.assertIn("用户名或手机号", wxml)
        self.assertIn("获取验证码", wxml)

    def test_profile_setup_has_nick_picker_and_wechat_id(self):
        self.assertTrue(PROFILE_WXML.is_file(), PROFILE_WXML)
        self.assertTrue(PROFILE_JS.is_file(), PROFILE_JS)
        wxml = PROFILE_WXML.read_text(encoding="utf-8")
        js = PROFILE_JS.read_text(encoding="utf-8")
        self.assertIn("完善资料", wxml)
        self.assertIn("显示名", wxml)
        self.assertIn("微信号", wxml)
        self.assertIn('type="nickname"', wxml)
        self.assertIn("可选入微信名", wxml)
        self.assertIn('bindnicknamereview="onNickReview"', wxml)
        self.assertNotIn('bindnicknamereview="onNick"', wxml)
        self.assertIn("applyNickValue", js)
        self.assertIn("onNickReview", js)
        # Refuse openid as wechatId on client
        self.assertIn("不要填 openid", js)
        app = APP_JSON.read_text(encoding="utf-8")
        self.assertIn("pages/profile-setup/profile-setup", app)
        self.assertIn("涨球乐", app)

    def test_profile_nick_review_does_not_clear(self):
        js = PROFILE_JS.read_text(encoding="utf-8")
        self.assertNotRegex(
            js,
            r"onNickReview\([\s\S]*?setData\(\{\s*displayName:\s*e\.detail\.value\s*\|\|\s*\"\"",
        )

    def test_api_friendly_errors_and_optional_nick(self):
        text = API_JS.read_text(encoding="utf-8")
        self.assertIn("FRIENDLY_ZH", text)
        self.assertIn("服务器繁忙，请稍后重试", text)
        self.assertIn("nickName: nickName || \"\"", text)


if __name__ == "__main__":
    unittest.main()
