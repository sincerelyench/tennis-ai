# 成长旅程 → UTR / 等级分成绩变化

## 问题

「成长旅程」原先展示挥拍分析分数与教练备注，与用户预期不符。用户要看的是 **UTR / 等级分** 随已确认比赛的变化。

## 改动

- `lib/local-ladder.ts`：新增 `buildRatingHistory`，按时间重放已确认比赛，记录种子分与每场后的等级分
- `app/api/friends/rating-history`：登录用户的等级分历程 API（单打/双打）
- `components/journey-view.tsx` / `journey-curve.tsx`：成长旅程页改为等级分摘要、曲线、对阵成绩列表
- `lib/i18n/messages.ts`：中英文案改为等级分旅程
- `report-view`：报告里的成长旅程入口改为 `/journey`（等级分）

## 部署

```bash
bash deploy/growth-journey-utr/scripts/apply-on-server.sh /opt/tennis-ai
```

## 保留

比分需对方确认才进 UTR；非官方 UTR；「我的」比赛成绩列表 tab 不变。
