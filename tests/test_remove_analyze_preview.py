"""Waiting UI must not expose 分析预览 / analysis preview surfaces."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / "deploy" / "remove-analyze-preview"


class RemoveAnalyzePreviewTests(unittest.TestCase):
    def test_gpu_index_has_no_preview_heading(self):
        html = (ROOT / "web" / "static" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("分析预览", html)
        self.assertIn("当前步骤", html)
        self.assertIn('id="detail"', html)

    def test_e1_queue_has_no_preview(self):
        js = (ROOT / "web" / "static" / "e1.js").read_text(encoding="utf-8")
        self.assertNotIn("queue.preview", js)
        self.assertNotIn("queuePreviewMarkup", js)
        self.assertNotIn("分析预览", js)
        self.assertIn("queue.currentStep", js)

    def test_i18n_dropped_preview_key(self):
        for name in ("zh-CN.json", "en.json"):
            data = json.loads((ROOT / "i18n" / name).read_text(encoding="utf-8"))
            self.assertNotIn("preview", data.get("queue", {}))

    def test_next_component_no_preview_card(self):
        tsx = (DEPLOY / "opt-patch" / "components" / "analyze-progress.tsx").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("分析预览", tsx)
        self.assertNotIn("zq-ap-preview", tsx)
        self.assertNotIn("上传后这里会显示你的录像预览", tsx)
        self.assertIn('data-no-analyze-preview="1"', tsx)
        self.assertIn("当前步骤", tsx)
        vue = (DEPLOY / "uniapp-patch" / "progress-roadmap.snippet.vue").read_text(
            encoding="utf-8"
        )
        self.assertIn("涨球教练", vue)

    def test_uniapp_snippet_no_preview(self):
        vue = (DEPLOY / "uniapp-patch" / "progress-roadmap.snippet.vue").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("分析预览", vue)
        self.assertNotIn("previewSrc", vue)
        self.assertNotIn("上传后这里会显示你的录像预览", vue)
        self.assertIn('data-no-analyze-preview="1"', vue)


if __name__ == "__main__":
    unittest.main()
