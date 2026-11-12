# 约球双 Tab：我的约球与本地排行（ZQ-75）

## 改动

- 子 Tab 更名：**我的约球** / **本地排行**（不再用「匹配约球」作子 Tab 名）
- **两边**都有直接「匹配约球」入口（同一套匹配能力）
- **我的约球**：匹配约球置顶；其下为成功记录 / 邀请 / 录分
- **本地排行**：先排行榜，下面再匹配约球
- 约球页文案大幅精简：去掉冗余引导与说明段
- **本地排行**：每人显示相对上次快照的名次/分数升降；点球员查看最近战绩
- 保留门禁：成功后邀请消失；录入对阵仅应战后；录分默认折叠；挑战需应战；不展示球员数；不轻易改显示名

## Apply

```bash
bash deploy/yueqiu-my-and-ladder/scripts/apply-on-server.sh /opt/tennis-ai
```

Preview: https://yqchen.blog/yueqiu-my-and-ladder.html
