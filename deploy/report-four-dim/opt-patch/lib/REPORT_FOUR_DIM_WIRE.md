# ReportFourDim wire notes (涨球)

Drop-in:

- `components/report-four-dim.tsx`
- `lib/report-four-dim.ts`

Usage on Next report page (`app/(main)/report/[id]/page.tsx` or score card):

```tsx
import { ReportFourDim } from "@/components/report-four-dim";

// Prefer full TAI report so speeds resolve from overall.speeds
<ReportFourDim report={taiReport} />

// Or pass pieces:
<ReportFourDim
  scores={taiReport?.overall?.scores}
  speeds={taiReport?.overall?.speeds}
/>
```

Place **above or replacing** the plain “分项得分 / Breakdown” table. Keep problem videos, coach demos, 涨球教练 copy unchanged.

Field map (TAI → UI):

| UI | TAI JSON |
| --- | --- |
| 重心 | `overall.scores["重心"]` (max 25) |
| 击球点 | `overall.scores["击球点"]` (max 20) |
| 动力链 | `overall.scores["动力链"]` (max 30) |
| 击球效果 | `overall.scores["击球效果"]` (max 25) |
| 拍头 | `overall.speeds.swing_kmh` (+ `swing_from`) |
| 手腕 | `overall.speeds.wrist_kmh` |
| 转髋 | `overall.speeds.hip_kmh` |
| 来球 | `overall.speeds.ball_in_kmh` |
| 出球 | `overall.speeds.ball_out_kmh` |
| 最快拍头 | `overall.speeds.swing_kmh_max` |

Public e1/mp `/api/jobs/{id}/result` also exposes remapped `axes[]` + `speeds.{racket,wrist,hip,ball_in,ball_out}_kmh`.
