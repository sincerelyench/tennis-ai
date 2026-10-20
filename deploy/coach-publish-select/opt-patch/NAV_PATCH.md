# Publish + coach picker nav (manual)

## Coach workspace

On `/library` (动作库), the publish panel renders below the stroke library:
CTAs **提交训练 / 申请发布 / 撤回**.

Keep coach display default **掌球教练** / Zhangqiu Coach (Mac may be applying rename PR #8 in parallel — do not reintroduce Poppy / 东东).

## Player

Insert a player tab / settings entry:

```ts
{ href: "/coaches", key: "coaches", labelKey: "coaches.nav" }
```

Route: `app/coaches/page.tsx` → `/tennis/coaches` (published coaches only).

## Analysis

When building report / coach-tab demos, call:

```ts
import { fetchCoachLibraryDemo, resolveAnalysisCoachId } from "@/lib/coach-library-analysis-hook";
const coachId = await resolveAnalysisCoachId();
const demo = await fetchCoachLibraryDemo(strokeId, coachId);
```
