"""ZQ-149: WeChat login autofills wechatId from openid (not nickName)."""

from __future__ import annotations

import hashlib
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH_STORE = ROOT / "deploy/wechat-autofill-wechatid/opt-patch/lib/auth-store.ts"
WECHAT_ROUTE = ROOT / "deploy/wechat-autofill-wechatid/opt-patch/app/api/auth/wechat/route.ts"
SESSION_JS = ROOT / "miniprogram/utils/session.js"


def sanitize_wechat_id(raw: str | None) -> str:
    id_ = re.sub(r"\s+", "", str(raw or "").strip())[:32]
    if not id_:
        return ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{3,32}", id_):
        return ""
    return id_


def wechat_id_from_openid(openid: str | None) -> str:
    oid = str(openid or "").strip()
    if not oid or len(oid) < 8 or len(oid) > 128:
        return ""
    direct = sanitize_wechat_id(oid)
    if direct:
        return direct
    hex_ = hashlib.sha256(f"wxid:{oid}".encode()).hexdigest()
    return sanitize_wechat_id("w" + hex_[:31])


def wechat_contact_satisfied(wechat_id: str | None, openid: str | None) -> bool:
    if sanitize_wechat_id(wechat_id):
        return True
    oid = str(openid or "").strip()
    return 8 <= len(oid) <= 128


class WechatAutofillWechatIdTests(unittest.TestCase):
    def test_kit_files_exist(self):
        self.assertTrue(AUTH_STORE.is_file(), AUTH_STORE)
        self.assertTrue(WECHAT_ROUTE.is_file(), WECHAT_ROUTE)
        self.assertTrue(SESSION_JS.is_file(), SESSION_JS)

    def test_auth_store_exports_helpers(self):
        text = AUTH_STORE.read_text(encoding="utf-8")
        self.assertIn("export function wechatIdFromOpenid", text)
        self.assertIn("export function wechatContactSatisfied", text)
        self.assertIn("auto-fill 微信号", text)
        self.assertIn("Lazy backfill", text)
        # nickName must not be assigned to wechatId
        self.assertNotRegex(
            text,
            r"wechatId\s*=\s*.*nick",
            "nickName must not be used as wechatId",
        )

    def test_wechat_route_returns_wechat_id(self):
        text = WECHAT_ROUTE.read_text(encoding="utf-8")
        self.assertIn("wechatId: result.wechatId", text)
        self.assertIn("needsProfileSetup", text)

    def test_mp_session_stores_wechat_id(self):
        text = SESSION_JS.read_text(encoding="utf-8")
        self.assertIn("wechatId: payload.wechatId", text)

    def test_typical_openid_written_verbatim(self):
        openid = "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"  # 28 chars, WeChat-shaped
        self.assertEqual(wechat_id_from_openid(openid), openid)
        self.assertTrue(wechat_contact_satisfied("", openid))
        self.assertFalse(wechat_contact_satisfied("", ""))

    def test_mock_openid_written_verbatim(self):
        openid = "mock_" + "a" * 24
        self.assertEqual(len(openid), 29)
        self.assertEqual(wechat_id_from_openid(openid), openid)

    def test_odd_charset_openid_hashed(self):
        # Dots/at are not allowed in wechatId → hash fallback.
        openid = "openid.with@odd.chars!!"
        self.assertEqual(sanitize_wechat_id(openid), "")
        got = wechat_id_from_openid(openid)
        self.assertTrue(got.startswith("w"))
        self.assertEqual(len(got), 32)
        self.assertEqual(got, sanitize_wechat_id(got))
        # stable
        self.assertEqual(got, wechat_id_from_openid(openid))

    def test_long_valid_openid_truncated(self):
        openid = "x" * 40
        self.assertEqual(wechat_id_from_openid(openid), "x" * 32)

    def test_existing_wechat_id_preferred(self):
        self.assertTrue(wechat_contact_satisfied("my_wechat_id", None))
        self.assertEqual(sanitize_wechat_id("my_wechat_id"), "my_wechat_id")


if __name__ == "__main__":
    unittest.main()
