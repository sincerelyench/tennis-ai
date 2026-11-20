"""ZQ-163: deploy kit mirrors prod empty-city ladder fallback."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNIPPET = ROOT / "deploy/ladder-empty-city-fallback/opt-patch/refresh-ladder.snippet.tsx"
APPLY = ROOT / "deploy/ladder-empty-city-fallback/scripts/apply-on-server.sh"


class LadderEmptyCityFallbackKit(unittest.TestCase):
    def test_snippet_has_wuxi_then_unscoped(self) -> None:
        text = SNIPPET.read_text(encoding="utf-8")
        self.assertIn("ZQ-163", text)
        self.assertIn("DEFAULT_CITY_ID", text)
        self.assertIn("persistCityId(DEFAULT_CITY_ID)", text)
        self.assertIn('fetchLadderRows("")', text)
        self.assertIn("TYkmlLDQzDJPdqlLUFLE5", text)
        # order: default city before unscoped
        i_default = text.index("cityId !== DEFAULT_CITY_ID")
        i_unscoped = text.index('fetchLadderRows("")')
        self.assertLess(i_default, i_unscoped)

    def test_apply_script_is_surgical(self) -> None:
        text = APPLY.read_text(encoding="utf-8")
        self.assertIn("refreshLadder", text)
        self.assertIn("ZQ-163", text)
        self.assertNotIn("cp -a \"$PATCH_DIR/opt-patch/components/friends-view.tsx\"", text)

    def test_snippet_replaces_baseline_refresh_ladder(self) -> None:
        baseline = '''  async function refreshLadder() {
    try {
      const q = new URLSearchParams({ format, cityId: cityId || "" });
      const res = await fetch(`/tennis/api/friends/ladder?${q}`, { credentials: "include" });
      if (!res.ok) {
        setLadderFromApi(false);
        return;
      }
      const data = (await res.json()) as {
        rows?: LadderApiRow[];
        count?: number;
        empty?: boolean;
      };
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setLadderRows(rows);
      setLadderFromApi(true);
      if (typeof data.count === "number" && data.count === 0) {
        /* empty = 0 — keep rows [] */
      }
    } catch {
      setLadderFromApi(false);
    }
  }

  async function refreshScores() {}
'''
        snippet = SNIPPET.read_text(encoding="utf-8").rstrip() + "\n"
        pat = re.compile(
            r"  async function refreshLadder\(\) \{.*?\n  \}\n(?=\n  async function refreshScores)",
            re.S,
        )
        out = pat.sub(snippet, baseline, count=1)
        self.assertIn("ZQ-163: empty city filter", out)
        self.assertIn("persistCityId(DEFAULT_CITY_ID)", out)
        self.assertIn("async function refreshScores", out)


if __name__ == "__main__":
    unittest.main()
