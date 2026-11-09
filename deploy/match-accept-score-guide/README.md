# 约球应战通知与录分引导

## 问题

对方应战后，发起方通知中心无提示；约球页也不显示「约球成功」或引导录入比分。

## 改动

- 约球页「匹配约球」下展示**全部约球成功记录**列表（应战后持久保留，含「去录入比分」）

- `lib/match-intros.ts`：应战时写 `acceptedAt` + `fromNotify`；`badge` 含发起方未读；`ackAccepted` / `ackAllAccepted`
- `app/api/friends/intros/route.ts`：返回 `acceptedNotify`；支持确认未读
- `components/notices-view.tsx`：发起方看到「已应战 · 约球成功」+ 录入比分入口
- `components/friends-view.tsx`：成功态文案 +「去录入比分」；等待应战时轮询
- `lib/i18n/messages.ts`：中英文案

## 部署

```bash
bash deploy/match-accept-score-guide/scripts/apply-on-server.sh /opt/tennis-ai
```

## 保留

微信互加文案、未回复可取消、邀请方应战通知、比分需对方确认才进 UTR。
