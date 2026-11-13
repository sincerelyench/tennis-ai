# 我的约球：我发出的邀请（ZQ-135）

## Problem

Outbound 约球 invites (`awaiting_accept`，发起方) had nowhere dedicated to show on「我的约球」. Incoming invites already had「新邀请」; successful ones sit under「约球成功」. Sent-and-waiting rows only partially surfaced in the top matchmaking card (one active at a time).

## Fix (code only)

| File | Change |
| --- | --- |
| `lib/match-intros.ts` | `listIntrosForUser` → `sentPending`（`iAmFrom` + `awaiting_accept`） |
| `app/api/friends/intros/route.ts` | GET 返回 `sentPending` |
| `components/friends-view.tsx` | 「我的约球」底部「我发出的邀请」列表 + 空态；取消走既有 `cancel` |
| `lib/i18n/messages.ts` | `matchSentPendingTitle` / `Empty` / `Waiting` |

- 应战成功后离开发出列表（只留 `awaiting_accept`）。
- 取消复用现有 `cancelIntro`；**无新的破坏性 DB 操作**。
- 认领仍走 buddyId / 正确手机号绑定（ZQ-125）。

## Apply on production

```bash
export SSHPASS=...
sshpass -e scp -r deploy/sent-invites-section root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/sent-invites-section/scripts/apply-on-server.sh /opt/tennis-ai'
```

Four-surface: Web `/tennis` is the WebView source for APK / IPA / mp-weixin — no binary rebuild required for this UI.

## Preview

https://yqchen.blog/sent-invites-section.html
