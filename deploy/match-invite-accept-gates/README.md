# 约球邀请 UX gates

1. 约球成功并进入成功记录后，不再展示该条「约球邀请」；仅新的待应战邀请显示。
2. 「录入对阵」不再在发出挑战/等待应战时出现；对方应战后通过「去录入比分」进入录分。

## Apply

```bash
bash deploy/match-invite-accept-gates/scripts/apply-on-server.sh /opt/tennis-ai
```

## Files

- `opt-patch/components/friends-view.tsx`
- `opt-patch/components/notices-view.tsx`
- `opt-patch/lib/match-intros.ts`
