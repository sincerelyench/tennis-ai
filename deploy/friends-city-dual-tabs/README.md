# 约球城市下双 Tab（匹配/排行）

## 问题

约球页仍混排匹配、录分与本地排行，并展示球员数量。

## 改动

- **不展示**球员数量（去掉 `cityCount` 副标题）
- 城市下拉框置顶；其下两个 Tab：
  - **匹配约球**：匹配流程 + 约球成功记录 + 应战/录分（沿用既有 accept 逻辑）
  - **本地排行**：该城排行榜；可对他人点 **挑战**（自己除外）；挑战走与匹配相同的对方同意流程
- i18n：`tabMatch` / `tabLadder` / `cityDualLead` / `mainTabsAria`

## 部署

```bash
bash deploy/friends-city-dual-tabs/scripts/apply-on-server.sh /opt/tennis-ai
```
