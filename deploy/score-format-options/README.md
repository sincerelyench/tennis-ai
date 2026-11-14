# ZQ-140 · 录入比分赛制选项

## Exact options (zh)

| 控件 | 选项 | 默认 |
| --- | --- | --- |
| 赛制 | **三盘两胜** / 五盘三胜 / 一盘制 | 三盘两胜 |
| 单局赛制（仅一盘制） | **抢7** / 抢10 / 自由一盘 | 抢7 |

## Behaviour

- 三盘两胜 → 最多 3 行盘分（可只填已打完的盘，与以往相同）
- 五盘三胜 → 最多 5 行盘分
- 一盘制 → 1 行；抢7/抢10 要求胜方局数 ≥ 7/10（不强制净胜 2）
- 仍存 `sets: [gamesA, gamesB][]`；UTR `winnerGameShare` 按局数合计
- `formatWeight`：1 盘或总局面 ≤12 → 0.8；≥3 盘 → 1.15；≥5 盘 → 1.2
- 确认 / 软排除（EXCLUDE_GAP=1.5）未改

## Apply

```bash
bash deploy/score-format-options/scripts/apply-on-server.sh /opt/tennis-ai
```

No Postgres migration; optional JSON fields `matchLength` / `shortFormat` on blob.
