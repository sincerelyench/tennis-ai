# ZQ-143 · 排行榜独立底栏 Tab

## 产品

- 底栏第 2 位（约球之后）：**排行榜** → `/ladder`
- **约球** 仅「我的约球」内容，去掉「我的约球 / 本地排行」顶栏双 Tab
- 排行榜保留：城市筛选、挑战、近期比赛结果、比赛综述、未经证明注明、战绩可见性

## 最终底栏顺序

| 分析 Tab | 顺序 |
| --- | --- |
| 隐藏（现网） | **约球 · 排行榜 · 教练 · 我的** |
| 开启 | **分析 · 约球 · 排行榜 · 教练 · 我的** |

## Apply

```bash
bash deploy/ladder-bottom-tab/scripts/apply-on-server.sh /opt/tennis-ai
```

Code only — no database writes.
