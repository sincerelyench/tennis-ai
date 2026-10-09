"""E1 upload shell: mock login, guide metadata, locale parity. No GPU."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

os.environ["TENNIS_AI_NO_WORKER"] = "1"

from fastapi.testclient import TestClient

import web.app as appmod
import web.upload_meta as upload_meta
from web.dev_auth import issue_dev_token, verify_dev_token

ROOT = Path(__file__).resolve().parents[1]
BANNED = ("医疗", "治伤", "伤病", "诊断", "保证涨分", "medical", "diagnos", "cure", "injury")


class E1ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.jobs = Path(self.tmp.name)
        self.old_jobs = appmod.JOBS_DIR
        appmod.JOBS_DIR = self.jobs
        with appmod._lock:
            self._saved_jobs = dict(appmod._jobs)
            appmod._jobs.clear()
        self.client = TestClient(appmod.app)
        self._max = upload_meta.MAX_VIDEO_BYTES

    def tearDown(self):
        upload_meta.MAX_VIDEO_BYTES = self._max
        with appmod._lock:
            appmod._jobs.clear()
            appmod._jobs.update(self._saved_jobs)
        appmod.JOBS_DIR = self.old_jobs
        self.tmp.cleanup()

    def _token(self, code="dev-user") -> str:
        res = self.client.post("/api/auth/mock", json={"code": code})
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body["login_mode"], "dev-mock")
        self.assertTrue(body["token"])
        self.assertIn("开发态", body["notice"])
        return body["token"]

    def _upload(self, token, *, name="swing.mp4", payload=None, data=None, client="miniprogram", checks=None):
        raw = payload if payload is not None else (b"\x00" * 1500)
        form = {
            "client": client,
            "stroke": "forehand",
            "sample": "0",
            "guide_completed": "0",
        }
        if checks is not None:
            form["guide_checks"] = json.dumps(checks)
        if data:
            form.update(data)
        headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
        return self.client.post(
            "/api/analyze",
            files={"video": (name, raw, "video/mp4")},
            data=form,
            headers=headers,
        )

    def test_mock_login_and_me(self):
        token = self._token("wx-code-1234")
        ok = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertTrue(ok.json()["user"]["id"].startswith("dev_"))
        missing = self.client.get("/api/auth/me")
        self.assertEqual(missing.status_code, 401)
        self.assertEqual(missing.json()["code"], "auth_invalid")
        self.assertIsInstance(missing.json()["detail"], str)

    def test_short_login_code_is_rejected(self):
        res = self.client.post("/api/auth/mock", json={"code": "ab"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "login_code_invalid")

    def test_token_expiry_and_tamper(self):
        issued = issue_dev_token("demo-code", now=1_700_000_000)
        token = issued["token"]
        self.assertIsNotNone(verify_dev_token(token, now=1_700_000_000 + 10))
        self.assertIsNone(verify_dev_token(token, now=1_700_000_000 + 8 * 24 * 3600))
        self.assertIsNone(verify_dev_token(token + "x", now=1_700_000_000 + 10))

    def test_miniprogram_requires_login(self):
        res = self._upload(None)
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["code"], "auth_required")
        self.assertIn("登录", res.json()["detail"])
        bad = self._upload("not-a-token")
        self.assertEqual(bad.status_code, 401)
        self.assertEqual(bad.json()["code"], "auth_invalid")

    def test_upload_stores_incomplete_guide_and_job_id(self):
        token = self._token()
        res = self._upload(token, checks={"side": True, "full_body": False, "racket": True})
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertTrue(body["job_id"])
        self.assertFalse(body["cached"])
        job = self.client.get("/api/jobs/" + body["job_id"])
        self.assertEqual(job.status_code, 200, job.text)
        payload = job.json()
        self.assertEqual(payload["status"], "queued")
        self.assertEqual(payload["id"], body["job_id"])
        self.assertFalse(payload["metadata"]["guide_completed"])
        self.assertEqual(payload["metadata"]["client"], "miniprogram")
        self.assertEqual(payload["metadata"]["guide_checks"]["side"], True)
        self.assertEqual(payload["metadata"]["guide_checks"]["full_body"], False)
        self.assertTrue(payload["metadata"]["user_id"])
        self.assertNotIn("video_path", payload)

    def test_completed_guide_flag_comes_from_checks(self):
        token = self._token()
        res = self._upload(
            token,
            client="e1",
            checks={"side": True, "full_body": True, "racket": True},
            data={"guide_completed": "0"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        job = self.client.get("/api/jobs/" + res.json()["job_id"]).json()
        self.assertTrue(job["metadata"]["guide_completed"])
        self.assertEqual(job["metadata"]["client"], "e1")

    def test_android_client_and_legacy_web_upload(self):
        token = self._token()
        android = self._upload(token, client="android", checks={"side": False, "full_body": False, "racket": False})
        self.assertEqual(android.status_code, 200, android.text)
        self.assertTrue(android.json()["job_id"])
        with appmod._lock:
            appmod._jobs.clear()
        legacy = self.client.post(
            "/api/analyze",
            files={"video": ("court.mp4", b"\x00" * 1500, "video/mp4")},
            data={"stroke": "backhand"},
        )
        self.assertEqual(legacy.status_code, 200, legacy.text)
        job = self.client.get("/api/jobs/" + legacy.json()["job_id"]).json()
        self.assertNotIn("metadata", job)

    def test_video_and_guide_errors_are_coded(self):
        token = self._token()
        tiny = self._upload(token, payload=b"x" * 20)
        self.assertEqual(tiny.status_code, 400)
        self.assertEqual(tiny.json()["code"], "video_too_small")
        kind = self._upload(token, name="notes.txt")
        self.assertEqual(kind.status_code, 400)
        self.assertEqual(kind.json()["code"], "video_type")
        self.assertIsInstance(kind.json()["detail"], str)
        upload_meta.MAX_VIDEO_BYTES = 2000
        huge = self._upload(token, payload=b"x" * 2500)
        self.assertEqual(huge.status_code, 400)
        self.assertEqual(huge.json()["code"], "video_too_large")
        bad_guide = self._upload(token, data={"guide_checks": "not-json"})
        self.assertEqual(bad_guide.status_code, 400)
        self.assertEqual(bad_guide.json()["code"], "guide_invalid")

    def test_busy_is_visible(self):
        with appmod._lock:
            appmod._jobs["busy-job"] = {"id": "busy-job", "status": "queued"}
        res = self._upload(self._token())
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()["code"], "busy")
        self.assertIn("稍后再试", res.json()["detail"])

    def test_e1_page_and_catalogs(self):
        page = self.client.get("/e1")
        self.assertEqual(page.status_code, 200)
        self.assertIn("涨球", page.text)
        self.assertIn("/e1/e1.js", page.text)
        script = self.client.get("/e1/e1.js")
        self.assertEqual(script.status_code, 200)
        self.assertNotIn("/report", script.text)
        self.assertNotIn("overall", script.text)
        zh = self.client.get("/i18n/zh-CN.json")
        en = self.client.get("/i18n/en.json")
        self.assertEqual(zh.status_code, 200)
        self.assertEqual(en.status_code, 200)
        self.assertEqual(zh.json()["appTitle"], "涨球")
        self.assertEqual(en.json()["guide"]["items"][0]["key"], "side")
        missing = self.client.get("/i18n/fr.json")
        self.assertEqual(missing.status_code, 404)


class E1CopyTests(unittest.TestCase):
    def test_locale_files_match_and_cover_guide(self):
        zh = json.loads((ROOT / "i18n" / "zh-CN.json").read_text(encoding="utf-8"))
        en = json.loads((ROOT / "i18n" / "en.json").read_text(encoding="utf-8"))
        self.assertEqual(_shape(zh), _shape(en))
        self.assertEqual([item["key"] for item in zh["guide"]["items"]], ["side", "full_body", "racket"])
        self.assertEqual([item["key"] for item in en["guide"]["items"]], ["side", "full_body", "racket"])
        for lang in ("zh-CN", "en"):
            js = (ROOT / "miniprogram" / "i18n" / f"{lang}.js").read_text(encoding="utf-8")
            self.assertTrue(js.startswith("module.exports = "))
            body = js[len("module.exports = ") :].strip()
            if body.endswith(";"):
                body = body[:-1]
            web = json.loads((ROOT / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
            self.assertEqual(json.loads(body), web)

    def test_client_copy_has_no_medical_claims_or_later_epics(self):
        chunks = []
        for path in (
            ROOT / "i18n" / "zh-CN.json",
            ROOT / "i18n" / "en.json",
            ROOT / "web" / "static" / "e1.html",
            ROOT / "web" / "static" / "e1.js",
            ROOT / "android" / "app" / "src" / "main" / "java" / "app" / "zhangqiu" / "MainActivity.java",
        ):
            chunks.append(path.read_text(encoding="utf-8"))
        for path in (ROOT / "miniprogram").rglob("*"):
            if path.suffix in {".js", ".wxml", ".json", ".wxss"} and path.is_file():
                chunks.append(path.read_text(encoding="utf-8"))
        blob = "\n".join(chunks).lower()
        for word in BANNED:
            self.assertNotIn(word.lower(), blob, word)
        for word in ("utr", "marketplace"):
            self.assertNotIn(word, blob)
        queue = (ROOT / "miniprogram" / "pages" / "queue" / "queue.js").read_text(encoding="utf-8")
        self.assertNotIn("/report", queue)
        self.assertNotIn("score", queue)


def _shape(value):
    if isinstance(value, dict):
        return {key: _shape(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_shape(item) for item in value]
    return "s"


if __name__ == "__main__":
    unittest.main()
