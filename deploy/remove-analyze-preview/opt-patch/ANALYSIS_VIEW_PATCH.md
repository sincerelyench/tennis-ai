# Wire `AnalyzeProgress` (no 分析预览)

```tsx
import { AnalyzeProgress } from "@/components/analyze-progress";

<AnalyzeProgress
  job={job}
  submitting={submitting}
  localPreviewUrl={localObjectUrl}  // accepted but unused; preview card removed
  taiBase="/tai"
/>
```

Waiting UI must **not** render `分析预览` / `Analysis preview` / `zq-ap-preview`.
Keep five-step roadmap, %, ETA leave hint, and 当前步骤.
Do not change stroke / apiStroke pass-through.
