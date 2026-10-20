"""Stroke / technique id normalization for product clients."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

os.environ["TENNIS_AI_NO_WORKER"] = "1"

from fastapi.testclient import TestClient

import web.app as appmod
from pipeline.stroke import (
    clip_id_for,
    measure_family,
    normalize_stroke,
    stroke_label,
)


class StrokeNormalizeTests(unittest.TestCase):
    def test_product_ids_pass_through(self):
        for sid in (
            "fh-topspin",
            "fh-slice",
            "bh-topspin",
            "bh-slice",
            "serve",
            "fh-volley",
            "bh-volley",
            "smash",
        ):
            self.assertEqual(normalize_stroke(sid), sid)

    def test_serve_aliases(self):
        self.assertEqual(normalize_stroke("发球"), "serve")
        self.assertEqual(normalize_stroke("Serve"), "serve")
        self.assertEqual(normalize_stroke("一发"), "serve")

    def test_unknown_defaults_forehand(self):
        self.assertEqual(normalize_stroke("unknown-xyz"), "forehand")
        self.assertEqual(normalize_stroke(""), "forehand")

    def test_measure_family(self):
        self.assertEqual(measure_family("serve"), "forehand")
        self.assertEqual(measure_family("bh-topspin"), "backhand")
        self.assertEqual(measure_family("fh-slice"), "forehand")

    def test_clip_id_and_label(self):
        self.assertEqual(clip_id_for("serve", "forehand"), "serve")
        self.assertEqual(stroke_label("serve"), "发球")
        self.assertEqual(stroke_label("fh-topspin"), "正手上旋")


class StrokeAnalyzeApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.jobs = Path(self.tmp.name)
        self.old_jobs = appmod.JOBS_DIR
        appmod.JOBS_DIR = self.jobs
        with appmod._lock:
            self._saved = dict(appmod._jobs)
            appmod._jobs.clear()
        self.client = TestClient(appmod.app)

    def tearDown(self):
        with appmod._lock:
            appmod._jobs.clear()
            appmod._jobs.update(self._saved)
        appmod.JOBS_DIR = self.old_jobs
        self.tmp.cleanup()

    def _token(self) -> str:
        res = self.client.post("/api/auth/mock", json={"code": "stroke-test"})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["token"]

    def test_serve_reaches_job(self):
        token = self._token()
        res = self.client.post(
            "/api/analyze",
            files={"video": ("serve.mp4", b"\x00" * 1500, "video/mp4")},
            data={
                "client": "miniprogram",
                "stroke": "serve",
                "sample": "0",
                "guide_completed": "0",
                "title": "发球 · serve.mp4",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        job_id = res.json()["job_id"]
        with appmod._lock:
            job = appmod._jobs[job_id]
        self.assertEqual(job["stroke_mode"], "serve", job)

    def test_fh_topspin_not_collapsed_blindly(self):
        token = self._token()
        res = self.client.post(
            "/api/analyze",
            files={"video": ("fh.mp4", b"\x00" * 1500, "video/mp4")},
            data={
                "client": "miniprogram",
                "stroke": "fh-topspin",
                "sample": "0",
                "guide_completed": "0",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        job_id = res.json()["job_id"]
        with appmod._lock:
            job = appmod._jobs[job_id]
        self.assertEqual(job["stroke_mode"], "fh-topspin", job)


if __name__ == "__main__":
    unittest.main()
