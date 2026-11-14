# ZQ-141 · 约球成功站内留言

## Product

- After 约球成功, both parties can always **留言** in-app (涨球).
- Delivery via **通知**: peer gets「新留言」→ opens thread (`/friends#chat-<introId>`).
- **Unread**: red dot on「留言」/「查看对话」while `messageUnread`; clears when the thread is opened.
- WeChat remains **optional** (visibility still only after accept); no wechatId does not block coordination.

## Apply

```bash
export SSHPASS="$(tr -d '\n' < /tmp/.zq-sshpass)"   # or Keychain voice-diary-prod
sshpass -e scp -r deploy/yueqiu-inapp-chat root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/yueqiu-inapp-chat/scripts/apply-on-server.sh /opt/tennis-ai'
```

## Storage

- Messages stored on each `MatchIntro` inside `match_intros_blob` (`messages[]`, `messageUnreadBy[]`).
- No mass deletes; no fake users; no new Postgres tables required.

## Files

| Path | Role |
| --- | --- |
| `opt-patch/lib/match-intros.ts` | post/list/ack + badge |
| `opt-patch/app/api/friends/messages/route.ts` | GET/POST API |
| `opt-patch/components/friends-view.tsx` | 留言入口 + 对话层 |
| `opt-patch/components/notices-view.tsx` | 新留言通知 |
| `opt-patch/lib/i18n/messages.ts` | zh/en copy |
