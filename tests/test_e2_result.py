"""E2 four-axis result and same-stroke progress. No GPU."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

os.environ["TENNIS_AI_NO_WORKER"] = "1"

from fastapi.testclient import TestClient

import web.app as appmod
from pipeline.analyze import SCORE_AXES

ROOT = Path(__file__).resolve().parents[1]
BANNED = ("医疗", "治伤", "伤病", "诊断", "保证涨分", "实验室级")


class ResultApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.jobs = root / "jobs"
        self.progress = root / "progress"
        self.jobs.mkdir()
        self.old_jobs = appmod.JOBS_DIR
        self.old_progress = appmod.PROGRESS_DIR
        appmod.JOBS_DIR = self.jobs
        appmod.PROGRESS_DIR = self.progress
        with appmod._lock:
            self._saved = dict(appmod._jobs)
            appmod._jobs.clear()
        self.client = TestClient(appmod.app)

    def tearDown(self):
        with appmod._lock:
            appmod._jobs.clear()
            appmod._jobs.update(self._saved)
        appmod.JOBS_DIR = self.old_jobs
        appmod.PROGRESS_DIR = self.old_progress
        self.tmp.cleanup()

    def _user(self, code: str) -> tuple[str, str]:
        res = self.client.post("/api/auth/mock", json={"code": code})
        self.assertEqual(res.status_code, 200, res.text)
        token = res.json()["token"]
        me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        return token, me.json()["user"]["id"]

    def _seed(
        self,
        job_id: str,
        user: str | None,
        scores: dict,
        *,
        stroke: str = "forehand",
        created: str = "2026-10-01T09:00:00+08:00",
        guide: bool = False,
        drills: list[str] | None = None,
        problems: list[str] | None = None,
        focus: str = "先把击球点打到身前",
        contact: float = 1.25,
        preview: bool = False,
        status: str = "done",
        write_report: bool = True,
    ) -> None:
        folder = self.jobs / job_id
        folder.mkdir()
        if write_report:
            report = {
                "generated_at": created,
                "focus": focus,
                "stroke_mode": stroke,
                "overall": {"score": sum(scores.values()), "scores": scores, "n_swings": 4},
                "clips": [
                    {
                        "id": stroke,
                        "analysis": {
                            "drills": drills or [],
                            "problems": problems or [],
                            "strengths": [],
                        },
                        "swings": [{"contact_t": contact}],
                    }
                ],
            }
            (folder / "report.json").write_text(json.dumps(report, ensure_ascii=False), encoding="utf-8")
        if preview:
            (folder / "preview.jpg").write_bytes(b"\xff\xd8preview")
        job = {
            "id": job_id,
            "status": status,
            "stroke_mode": stroke,
            "created_at": created,
        }
        if user is not None:
            job["metadata"] = {
                "user_id": user,
                "guide_completed": guide,
                "client": "e1",
                "auth": "dev-mock",
            }
        with appmod._lock:
            appmod._jobs[job_id] = job

    def _result(self, job_id: str, token: str | None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return self.client.get(f"/api/jobs/{job_id}/result", headers=headers)

    def test_axes_tips_guide_warning_and_stored_point(self):
        token, user = self._user("player-lin")
        scores = {"重心": 16, "击球点": 12, "动力链": 18, "击球效果": 14}
        self._seed(
            "jobfore0001",
            user,
            scores,
            drills=["把击球点放到身前，慢速打 10 个。"],
            problems=["这是伤病高发模式，先转体。"],
            preview=True,
            guide=False,
        )
        missing = self._result("jobfore0001", None)
        self.assertEqual(missing.status_code, 200, missing.text)
        self.assertEqual(missing.json()["progress"]["reason"], "sign_in")
        self.assertFalse(missing.json()["progress"]["compare_ready"])
        self.assertFalse(self.progress.exists() and any(self.progress.iterdir()))

        res = self._result("jobfore0001", token)
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual([axis["key"] for axis in body["axes"]], ["balance", "contact", "chain", "effect"])
        self.assertEqual([axis["score"] for axis in body["axes"]], [16, 12, 18, 14])
        self.assertEqual([axis["max"] for axis in body["axes"]], [25, 20, 30, 25])
        tips = {axis["key"]: axis["tip"] for axis in body["axes"]}
        self.assertIn("身前", tips["contact"])
        self.assertTrue(all(tips.values()))
        self.assertNotIn("伤病", res.text)
        for word in BANNED:
            self.assertNotIn(word, res.text)
        self.assertTrue(body["guide_warning"])
        self.assertFalse(body["guide_completed"])
        self.assertEqual(body["focus"], "先把击球点打到身前")
        self.assertEqual(body["contact_t"], 1.25)
        self.assertEqual(body["thumbnail"], "/api/jobs/jobfore0001/preview")
        self.assertEqual(body["total"], 60)
        self.assertFalse(body["progress"]["compare_ready"])
        self.assertEqual(body["progress"]["reason"], "need_two")
        self.assertEqual(body["progress"]["count"], 1)
        self.assertNotIn("video_path", body)

        stored = json.loads((self.progress / f"{user}.json").read_text(encoding="utf-8"))
        item = stored["items"][0]
        self.assertEqual(item["user_id"], user)
        self.assertEqual(item["stroke"], "forehand")
        self.assertEqual(item["job_id"], "jobfore0001")
        self.assertEqual(item["scores"]["重心"], 16)
        self.assertEqual(item["scores"]["击球点"], 12)
        self.assertEqual(item["scores"]["动力链"], 18)
        self.assertEqual(item["scores"]["击球效果"], 14)
        self.assertEqual(item["thumbnail"], "/api/jobs/jobfore0001/preview")
        self.assertEqual(item["contact_t"], 1.25)
        self.assertTrue(item["created_at"])

        again = self._result("jobfore0001", token)
        self.assertEqual(len(json.loads((self.progress / f"{user}.json").read_text())["items"]), 1)
        self.assertEqual(again.json()["progress"]["count"], 1)

    def test_comparison_opens_only_for_same_user_and_stroke(self):
        token, user = self._user("player-lin")
        other_token, _other = self._user("player-other")
        first = {"重心": 16, "击球点": 12, "动力链": 18, "击球效果": 14}
        second = {"重心": 18, "击球点": 14, "动力链": 20, "击球效果": 16}
        self._seed("jobfore0001", user, first, created="2026-10-01T09:00:00+08:00", guide=True)
        self._seed("jobfore0002", user, second, created="2026-10-12T09:00:00+08:00", guide=True)
        self._seed(
            "jobback0001",
            user,
            second,
            stroke="backhand",
            created="2026-10-12T10:00:00+08:00",
            guide=True,
        )
        self._seed(
            "jobserv0001",
            user,
            second,
            stroke="serve",
            created="2026-10-12T11:00:00+08:00",
            guide=True,
        )
        self._result("jobfore0001", token)
        opened = self._result("jobfore0002", token).json()
        self.assertTrue(opened["progress"]["compare_ready"])
        self.assertEqual(opened["progress"]["reason"], "")
        self.assertEqual(opened["progress"]["count"], 2)
        self.assertFalse(opened["guide_warning"])
        deltas = opened["progress"]["comparison"]["deltas"]
        self.assertEqual(deltas, {"balance": 2, "contact": 2, "chain": 2, "effect": 2})
        self.assertEqual(opened["progress"]["comparison"]["earlier"]["job_id"], "jobfore0001")
        self.assertEqual(opened["progress"]["comparison"]["later"]["job_id"], "jobfore0002")
        self.assertTrue(opened["progress"]["items"][1]["current"])

        back = self._result("jobback0001", token).json()
        self.assertFalse(back["progress"]["compare_ready"])
        self.assertEqual(back["progress"]["count"], 1)
        self.assertEqual(back["stroke"], "backhand")
        serve = self._result("jobserv0001", token).json()
        self.assertEqual(serve["stroke"], "serve")
        self.assertEqual(serve["progress"]["reason"], "need_two")

        foreign = self._result("jobfore0002", other_token)
        self.assertEqual(foreign.status_code, 200, foreign.text)
        self.assertEqual(foreign.json()["progress"]["reason"], "not_owner")
        self.assertEqual(foreign.json()["progress"]["items"], [])
        self.assertEqual(foreign.json()["axes"][0]["score"], 18)
        self.assertEqual(len(json.loads((self.progress / f"{user}.json").read_text())["items"]), 4)

    def test_anonymous_job_is_not_stored(self):
        scores = {"重心": 10, "击球点": 10, "动力链": 10, "击球效果": 10}
        self._seed("jobanon0001", None, scores)
        res = self._result("jobanon0001", None)
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["progress"]["reason"], "no_user")
        self.assertFalse(self.progress.exists() and any(self.progress.glob("*.json")))

    def test_pending_and_failed_jobs(self):
        token, user = self._user("player-lin")
        self._seed("jobwait00001", user, {}, status="queued", write_report=False)
        pending = self._result("jobwait00001", token)
        self.assertEqual(pending.status_code, 409)
        self.assertEqual(pending.json()["code"], "result_pending")
        self._seed("jobfail00001", user, {}, status="error", write_report=False)
        failed = self._result("jobfail00001", token)
        self.assertEqual(failed.status_code, 409)
        self.assertEqual(failed.json()["code"], "result_unavailable")
        missing = self._result("jobmissing01", token)
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json()["code"], "result_missing")

    def test_serve_label_is_kept_on_upload(self):
        token, _user = self._user("player-lin")
        res = self.client.post(
            "/api/analyze",
            files={"video": ("swing.mp4", b"\x00" * 1500, "video/mp4")},
            data={"stroke": "serve", "client": "e1", "sample": "0", "guide_completed": "1", "guide_checks": "{}"},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        job = self.client.get("/api/jobs/" + res.json()["job_id"]).json()
        self.assertEqual(job["stroke_mode"], "serve")


class ResultCopyTests(unittest.TestCase):
    def test_axis_caps_match_analysis(self):
        self.assertEqual([name for name, _cap in SCORE_AXES], ["重心", "击球点", "动力链", "击球效果"])

    def test_clients_have_result_route_without_banned_claims(self):
        script = (ROOT / "web" / "static" / "e1.js").read_text(encoding="utf-8")
        self.assertIn("/result", script)
        self.assertIn("guide_warning", script)
        self.assertNotIn("/report", script)
        self.assertNotIn("overall", script)
        queue = (ROOT / "miniprogram" / "pages" / "queue" / "queue.js").read_text(encoding="utf-8")
        self.assertIn("/pages/result/result", queue)
        self.assertNotIn("score", queue)
        self.assertNotIn("/report", queue)
        zh = json.loads((ROOT / "i18n" / "zh-CN.json").read_text(encoding="utf-8"))
        en = json.loads((ROOT / "i18n" / "en.json").read_text(encoding="utf-8"))
        self.assertEqual(list(zh["result"]["axes"]), ["balance", "contact", "chain", "effect"])
        self.assertEqual(list(en["result"]["axes"]), list(zh["result"]["axes"]))
        blob = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (
                ROOT / "i18n" / "zh-CN.json",
                ROOT / "i18n" / "en.json",
                ROOT / "web" / "static" / "e1.js",
                ROOT / "miniprogram" / "pages" / "result" / "result.js",
                ROOT / "miniprogram" / "pages" / "result" / "result.wxml",
            )
        )
        for word in BANNED + ("medical", "diagnos", "cure", "injury", "utr", "marketplace"):
            self.assertNotIn(word.lower(), blob.lower(), word)


if __name__ == "__main__":
    unittest.main()
