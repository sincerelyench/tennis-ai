# 匹配应战确认与通知中心

匹配/挑战成功后进入 `awaiting_accept`：对方在通知中心选择应战或婉拒，发起方等待确认。应战后进入微信约球引导（`pending`）。

## 改动

- `lib/match-intros.ts`：匹配与挑战默认 `awaiting_accept`；`badge` / `pendingAccept`；`publicIntro` 带角色字段
- `app/api/friends/intros`：返回 badge；支持 `decline`
- `components/friends-view.tsx`：匹配后等待应战；收件文案修正
- `components/notices-view.tsx`：通知中心展示邀请/挑战并应战
- `components/app-shell.tsx`：铃铛红点
- `lib/i18n/messages.ts`：中英抄文案

## 应用

```bash
bash deploy/match-challenge-notify/scripts/apply-on-server.sh /opt/tennis-ai
```

Preview: `/tennis/match-challenge-notify.html`
