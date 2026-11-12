# Profile WeChat required (完善资料 + 约球)

## Product
- 完善资料必填：**显示名** + **微信号**（约球必需）；城市仍可填但不单独触发弹窗。
- 已齐全（含刷新）不弹。
- 微信号默认不公开；**仅约球/挑战被接受后**向对方展示。

## Files
- `lib/auth-store.ts` — `wechatId`, `needsProfileSetup` = 缺名或缺微信号
- `lib/session-role.ts` — session `wechatId` + hydrate-safe gate
- `components/profile-setup.tsx` — 微信号字段
- `app/api/auth/{session,profile}/route.ts`
- `lib/match-intros.ts` — `opponentWechat` after accept only
- `components/friends-view.tsx` — show counterpart WeChat after success
- `lib/i18n/messages.ts`

## Apply
```bash
bash scripts/apply-on-server.sh /opt/tennis-ai
# or remote:
SSHPASS=… bash scripts/apply-on-server.sh
```

## Ops constraint
- Code/deploy OK. **Do not delete/rewrite live DB** (schema or data) without Yanqing explicit approval.
- Prefer full `next build` finish before `systemctl restart tennis-ai`; avoid concurrent rebuilds.
