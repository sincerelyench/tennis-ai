# ZQ-136 A+B+C：弱敌计分可见反馈

## Product (Yanqing chose A+B+C)

| 项 | 内容 |
| --- | --- |
| **A** | `EXCLUDE_GAP` **1.0 → 1.5**（约 NTRP 3.0 vs 2.5 全权重计入） |
| **B** | 分差 > 1.5 的热门胜改为 **软排除**：`mrWin = 赛前 + 0.05`，权重 × **0.25**（略有正反馈，非 Δ=0） |
| **C** | 成长旅程 / 最近战绩：软排除、几乎不变时用中文注明 |

## Soft-exclude formula

```
if favorite_win and |preΔ| > 1.5:
  matchRating_winner = clamp(preRating_winner + 0.05)
  weight *= 0.25   # on top of format × closeness × recency × reliability
  loser: W–L only (rating unchanged)
else:
  full UTR-style path (winner MR floored at preRating)
```

## Apply

```bash
bash deploy/exclude-gap-soft-abc/scripts/apply-on-server.sh /opt/tennis-ai
```

Code-only. No DB writes (ratings replayed).

## Tests

```bash
python3 -m unittest tests.test_exclude_gap_soft_abc -v
```

## Four-surface

Web deploy required. APK / IPA / 小程序 WebView → live `/tennis`（服务端重放 + 文案，无需重打壳）。
