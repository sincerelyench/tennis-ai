# ZQ-144 / ZQ-136 follow-up：每场已确认比赛都要动分

## Product
Yanqing: avoid “打完 Δ=0”. Almost every confirmed match should move scores a little (≥ **0.1** at one-decimal display). Winner **or** loser (usually both) must shift — e.g. 陈燕青 vs 陈发财.

## Formula (on top of A+B+C)
| Lever | Value |
| --- | --- |
| `SOFT_EXCLUDE_BOOST` | **0.1** (was 0.05) |
| `SOFT_EXCLUDE_WEIGHT` | **0.5** (was 0.25) |
| Soft path loser | also `mr = pre − 0.1` (was unchanged) |
| `MIN_VISIBLE_DELTA` | **0.1** — after each counted match, flat winner → `+0.1`; flat loser → `−0.1` (unless loser already rose ≥0.1) |
| Win floor | kept (`mrWin = max(computed, pre)`) |

## Apply
```bash
bash deploy/always-move-rating/scripts/apply-on-server.sh /opt/tennis-ai
```
Code-only. No DB writes.

**Note:** Does **not** overwrite `components/friends-view.tsx` (ZQ-143 ladder bottom tab). Rating UI hints already live there from A+B+C; this kit patches `local-ladder.ts`, `messages.ts`, `journey-view.tsx` only.

## Tests
```bash
python3 -m unittest tests.test_always_move_rating -v
```

## Four-surface
Web deploy. APK/IPA/mp WebView → live `/tennis`.
