"""ZQ-164: cityReady must not block ladder reads."""
from __future__ import annotations
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "deploy/ladder-city-ready-unblock/README.md"
APPLY = ROOT / "deploy/ladder-city-ready-unblock/scripts/apply-on-server.sh"

class Kit(unittest.TestCase):
    def test_readme_names_root_cause(self):
        text = README.read_text(encoding="utf-8")
        self.assertIn("cityReady", text)
        self.assertIn("refreshLadder", text)
        self.assertIn("onPickCity", text)

    def test_apply_is_surgical(self):
        text = APPLY.read_text(encoding="utf-8")
        self.assertIn("ZQ-164", text)
        self.assertIn("useState(true)", text)
        self.assertIn("AbortSignal.timeout(2500)", text)
        self.assertIn("setCityReady(true); // ZQ-164: manual city must unlock", text)
        self.assertNotIn("cp -a \"$PATCH_DIR/opt-patch/components/friends-view.tsx\"", text)

if __name__ == "__main__":
    unittest.main()


class AuthEmptyGuardKit(unittest.TestCase):
    def test_auth_guard_script_exists(self) -> None:
        path = ROOT / "deploy/ladder-city-ready-unblock/scripts/apply-auth-empty-guard.sh"
        text = path.read_text(encoding="utf-8")
        self.assertIn("ZQ-164b", text)
        self.assertIn("ladderAuthError", text)
        self.assertIn("visibilitychange", text)
