"""Fast-path / cache / honest ETA — no GPU required."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

os.environ["TENNIS_AI_NO_WORKER"] = "1"

from fastapi.testclient import TestClient

import web.app as appmod
from pipeline.session import FAST_MAX_SECONDS


class AnalyzeFastTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.jobs = root / "jobs"
        self.sample_cache = root / "sample_cache"
        self.content_cache = root / "content_cache"
        self.reports = root / "reports"
        self.progress = root / "progress"
        self.jobs.mkdir()
        self.sample_cache.mkdir()
        self.content_cache.mkdir()
        self.reports.mkdir()
        self.progress.mkdir()

        self.old = {
            "JOBS_DIR": appmod.JOBS_DIR,
            "SAMPLE_CACHE_DIR": appmod.SAMPLE_CACHE_DIR,
            "CONTENT_CACHE_DIR": appmod.CONTENT_CACHE_DIR,
            "REPORTS_DIR": appmod.REPORTS_DIR,
            "PROGRESS_DIR": appmod.PROGRESS_DIR,
            "SAMPLE_CANDIDATES": list(appmod.SAMPLE_CANDIDATES),
        }
        appmod.JOBS_DIR = self.jobs
        appmod.SAMPLE_CACHE_DIR = self.sample_cache
        appmod.CONTENT_CACHE_DIR = self.content_cache
        appmod.REPORTS_DIR = self.reports
        appmod.PROGRESS_DIR = self.progress
        with appmod._lock:
            self._saved = dict(appmod._jobs)
            appmod._jobs.clear()
        self.client = TestClient(appmod.app)

    def tearDown(self):
        with appmod._lock:
            appmod._jobs.clear()
            appmod._jobs.update(self._saved)
        for k, v in self.old.items():
            setattr(appmod, k, v)
        self.tmp.cleanup()

    def _seed_sample_cache(self, stroke="forehand", level="3.0"):
        src = Path(self.tmp.name) / "demo.mp4"
        src.write_bytes(b"\x00" * 2048)
        appmod.SAMPLE_CANDIDATES = [src]
        cache = appmod._sample_cache_dir(src, stroke, level)
        cache.mkdir(parents=True)
        report = {
            "overall": {"score": 71, "n_swings": 2},
            "source_name": "demo.mp4",
            "analyze_mode": "full",
            "stroke_mode": stroke,
            "clips": [],
        }
        (cache / "report.json").write_text(json.dumps(report), encoding="utf-8")
        return src

    def test_sample_cache_returns_inline_report_under_budget(self):
        self._seed_sample_cache(stroke="serve")
        res = self.client.post(
            "/api/analyze",
            data={"sample": "1", "stroke": "serve", "level": "3.0", "title": "t"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertTrue(body["cached"])
        self.assertEqual(body["status"], "done")
        self.assertIn("report", body)
        self.assertEqual(body["report"]["overall"]["score"], 71)
        self.assertEqual(body["analyze_mode"], "full")
        # Stroke must stay serve (not collapsed to forehand).
        job = self.client.get("/api/jobs/" + body["job_id"]).json()
        self.assertEqual(job["stroke_mode"], "serve")
        self.assertEqual(job["eta_remaining_s"], 0)
        self.assertIn("缓存", job["eta_hint"])

    def test_eta_fast_uses_seconds_not_minutes(self):
        fields = appmod._eta_fields(
            {"status": "running", "step": 2, "analyze_mode": "fast", "max_seconds": FAST_MAX_SECONDS}
        )
        self.assertLessEqual(fields["eta_remaining_s"], 3)
        self.assertTrue(any("秒" in (s.get("label") or "") for s in fields["eta_steps"]))
        self.assertFalse(any("分钟" in (s.get("label") or "") for s in fields["eta_steps"]))

    def test_content_hash_cache_hit(self):
        import hashlib

        raw = b"\x01" * 2500
        digest = hashlib.sha256(raw).hexdigest()
        cache = appmod._content_cache_dir(digest, "fh-topspin", "3.0", "fast")
        cache.mkdir(parents=True)
        (cache / "report.json").write_text(
            json.dumps(
                {
                    "overall": {"score": 55, "n_swings": 1},
                    "source_name": "clip.mp4",
                    "analyze_mode": "fast",
                    "stroke_mode": "fh-topspin",
                }
            ),
            encoding="utf-8",
        )
        with mock.patch.object(appmod, "_video_duration_s", return_value=3.0):
            res = self.client.post(
                "/api/analyze",
                files={"video": ("clip.mp4", raw, "video/mp4")},
                data={"stroke": "fh-topspin", "sample": "0", "level": "3.0"},
            )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertTrue(body["cached"])
        self.assertEqual(body["report"]["overall"]["score"], 55)
        job = self.client.get("/api/jobs/" + body["job_id"]).json()
        self.assertEqual(job["stroke_mode"], "fh-topspin")


if __name__ == "__main__":
    unittest.main()
