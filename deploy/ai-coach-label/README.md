# ZQ-79 · AI 教练改名并隐藏背景水平

## UX

1. 教练 Tab 里 AI 教练显示名为 **「AI 教练」**（不要涨球教练 / 掌球教练 / Poppy / 东东）
2. **仅 AI 教练**：不展示背景介绍与专业水平 / 履历
3. 真人网络教练可保留各自背景与水平
4. 对外产品品牌仍可用「涨球」

## Apply

```bash
bash deploy/ai-coach-label/scripts/apply-on-server.sh /opt/tennis-ai
```

Does **not** touch `components/friends-view.tsx` or `lib/feature-flags.ts`.

## Files

- `opt-patch/components/coach-picker.tsx` — AI profile card: no bio/level; label AI 教练
- `opt-patch/components/coach-video-upload.tsx` — user-facing AI 教练 copy
- `opt-patch/lib/coach-publish.ts` — DEFAULT_COACH_NAME → AI 教练 / AI Coach
- `opt-patch/lib/i18n/messages.ts` — coach.title / roster.poppy.name·short
- `preview/index.html` — static proof page
