# Wire `AnalyzeProgress` in analysis view

Replace the thin percent-only waiting card with:

```tsx
import { AnalyzeProgress } from "@/components/analyze-progress";

// while submitting || job.status in queued|running:
<AnalyzeProgress
  job={job}
  submitting={phase === "submitting"}
  localPreviewUrl={localObjectUrl}
  taiBase={process.env.NEXT_PUBLIC_TAI_BASE || "/tai"}
  title={t("analysis.analyzing")}
/>
```

## Rules

- Keep existing stroke / `apiStroke` FormData pass-through unchanged.
- Do **not** show an NTRP level picker on this waiting surface.
- Default coach copy: **涨球教练** / Zhangqiu Coach.
- Prefer `job.eta_steps` + `job.eta_hint` + `job.preview_rev` from `GET /tai/api/jobs/{id}`.
- Persist active job id (existing `tennis-active-job-v1` / equivalent) so returning to Analyze reopens this progress UI.

## Uni-app

See `uniapp-patch/README.md` — same roadmap markup; poll the same `/tai` fields.
