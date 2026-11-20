"""ZQ-164c kit: hard reload error boundary + MicroMessenger tab nav."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "deploy" / "mp-error-hard-reload"


class MpErrorHardReloadKit(unittest.TestCase):
    def test_error_tsx_hard_reload(self) -> None:
        text = (KIT / "opt-patch" / "app" / "(main)" / "error.tsx").read_text(encoding="utf-8")
        self.assertIn("location.reload", text)
        self.assertIn('data-error-retry="hard"', text)
        self.assertIn("ZQ-164c", text)
        # Button path must hard-reload, not only reset()
        self.assertIn("function hardRetry", text)
        self.assertIn('onClick={hardRetry}', text)
        self.assertNotIn("onClick={() => reset()}", text)

    def test_app_shell_micromessenger_hard_nav(self) -> None:
        text = (KIT / "opt-patch" / "components" / "app-shell.tsx").read_text(encoding="utf-8")
        self.assertIn("MicroMessenger", text)
        self.assertIn("location.assign", text)
        self.assertIn("ZQ-164c", text)
        self.assertNotIn("<Onboarding", text)

    def test_apply_script_patches_i18n(self) -> None:
        text = (KIT / "scripts" / "apply-on-server.sh").read_text(encoding="utf-8")
        self.assertIn("页面暂时不可用", text)
        self.assertIn("atomic-next-rebuild", text)


if __name__ == "__main__":
    unittest.main()
