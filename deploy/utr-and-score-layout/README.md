# UTR 风格等级分 + 约球录分布局（ZQ-72）

## A. 等级分

公开 UTR 口径近似（非官方 Universal Tennis）：

- 局胜率 vs 预期 → match rating → 近 12 月 ≤30 场加权平均
- 分差 > 2.0 且热门按预期取胜通常不计
- <~5 场标 (P)；单打/双打分开

## B. 约球布局

1. 「录入比分」表单默认隐藏，点击后再展开
2. 顺序：约球成功 + 比赛记录 → 新约球邀请 → 匹配约球
3. 保留应战门禁：未应战不可录分；成功后离开邀请列表

## Apply

```bash
bash deploy/utr-and-score-layout/scripts/apply-on-server.sh /opt/tennis-ai
```

## Tests

```bash
python3 -m unittest tests.test_official_utr_ladder -v
```
