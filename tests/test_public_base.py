"""Subpath deploy: /tai must keep API calls under the public prefix."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PublicBaseTests(unittest.TestCase):
    def test_frontend_uses_api_url_helper(self):
        html = (ROOT / "web" / "static" / "index.html").read_text(encoding="utf-8")
        self.assertIn("function apiUrl(path)", html)
        leftover = re.findall(r"""fetch\(\s*['\"]api/""", html)
        self.assertEqual(leftover, [], "相对 fetch 在 /tai 无尾斜线时会打到博客根路径")

    def test_blog_proxy_snippet_targets_existing_service(self):
        snippet = (ROOT / "deploy" / "nginx-yqchen-blog-tai.conf").read_text(encoding="utf-8")
        self.assertIn("location ^~ /tai/", snippet)
        self.assertIn("proxy_pass http://47.93.203.28/tennis-ai/", snippet)
        self.assertIn("client_max_body_size 400m", snippet)

    def test_publish_script_targets_ipitch_default_server(self):
        script = (ROOT / "deploy" / "publish-yqchen-tai.sh").read_text(encoding="utf-8")
        self.assertIn("/etc/nginx/conf.d/ipitch.conf", script)
        self.assertIn("snippets/yqchen-tai.conf", script)


if __name__ == "__main__":
    unittest.main()
