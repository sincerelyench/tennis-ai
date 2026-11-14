# ZQ-139 · 设置「战绩可见」

## Product

- 设置增加 **战绩可见**：默认 **全局可见**；可选 **不可见**。
- **不可见** 时：其他人在排行榜下看不到该用户的最近战绩（用户弹窗「最近战绩」整段不展示；城市公开「比赛结果」也不含该用户的场次）。
- 资料级偏好，与单场录入「展示/隐藏」(ZQ-138) **并存**：资料关 → 全部公开战绩隐藏；资料开 → 单场隐藏仍挡个别场次。
- **不影响** 等级分 / UTR；约战双方在约球双方视图中仍可见共同比赛。

## Exact copy (zh)

| Key | Copy |
| --- | --- |
| Label | 战绩可见 |
| On | 全局可见 |
| Off | 不可见 |
| Hint | 设为不可见后，其他人在排行榜下看不到你的最近战绩。不影响等级分；约战双方仍可见共同比赛。 |

## Code (opt-patch from live `/opt/tennis-ai`)

| File | Change |
| --- | --- |
| `lib/auth-store.ts` | `matchHistoryPublic` on AuthUser; helpers; profile/session |
| `lib/session-role.ts` | Client session field |
| `lib/match-scores.ts` | `listConfirmedScoresForCity` also gates on profile visibility |
| `app/api/auth/profile/route.ts` | GET/PATCH `matchHistoryPublic` |
| `app/api/auth/session/route.ts` | Expose preference |
| `app/api/friends/player-matches/route.ts` | `historyHidden` for others when off; per-match hide still filters |
| `components/profile-view.tsx` | Settings toggle |
| `components/friends-view.tsx` | Hide recent section when `historyHidden` |
| `lib/i18n/messages.ts` | zh/en copy |

`listConfirmedLadderMatches` unchanged → UTR/ladder still counts.

## Migration

**None.** Field on auth JSON blob (`matchHistoryPublic`). Missing = **全局可见**. No rewrite of existing users or scores.

## Apply

```bash
export SSHPASS=...
sshpass -e scp -r deploy/match-history-visibility root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/match-history-visibility/scripts/apply-on-server.sh /opt/tennis-ai'
```

Four-surface: WebView clients pick up `/tennis` after apply; no APK/IPA rebuild.

## Preview

https://yqchen.blog/match-history-visibility.html
