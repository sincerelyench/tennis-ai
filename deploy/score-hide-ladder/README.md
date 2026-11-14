# ZQ-138 · 录入比分可隐藏不进排行榜「比赛结果」

## Product

- 录入比分默认 **展示**。
- 录入方与确认方各自可选 **展示 / 隐藏**；确认时锁定：任一方隐藏 → 该场不进排行榜下公开「比赛结果」。
- **不影响** 等级分 / UTR / 评分变化。
- 约战双方仍可在约球成功、待确认、己方比分列表中看到完整比赛。

## Code (opt-patch from live `/opt/tennis-ai`)

| File | Change |
| --- | --- |
| `lib/match-scores.ts` | JSON privacy fields; `isHiddenFromPublicFeed`; filter only `listConfirmedScoresForCity` |
| `app/api/friends/scores/route.ts` | POST accepts `hideFromPublic` |
| `app/api/friends/scores/action/route.ts` | confirm accepts `hideFromPublic` |
| `components/friends-view.tsx` | 展示/隐藏 UI on entry + confirm |
| `lib/i18n/messages.ts` | zh/en privacy copy |

`listConfirmedLadderMatches` unchanged → UTR/ladder still counts hidden matches.

## Migration

**None.** Fields live on `match_scores_blob` JSON payload. Existing scores without fields remain **展示**.

## Apply

```bash
export SSHPASS=...
sshpass -e scp -r deploy/score-hide-ladder root@8.216.53.29:/tmp/
sshpass -e ssh root@8.216.53.29 'bash /tmp/score-hide-ladder/scripts/apply-on-server.sh /opt/tennis-ai'
```

Four-surface: WebView clients pick up `/tennis` after apply; no APK/IPA rebuild.

## Preview

https://yqchen.blog/score-hide-ladder.html
