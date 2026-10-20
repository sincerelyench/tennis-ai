# Manual wiring after apply (涨球 · restore star demos)

## Analysis / report / filming example

1. **拍摄示例 / filming example**  
   Replace `filmingExamples[stroke].video` (`/tennis/examples/*.mp4`) with:
   ```ts
   import { platformFilmingExample } from "@/lib/platform-demo";
   // or
   import { platformStarDemoSync } from "@/lib/coach-library-analysis-hook";
   const demo = platformStarDemoSync(strokeId);
   // render <StarDemoPlayer strokeId={strokeId} /> or iframe src={demo.embedUrl}
   ```
   Do **not** use muddy `/tennis/examples/*.mp4` as default platform refs.

2. **正确动作 / Correct form**  
   ```ts
   const demo = await fetchCoachLibraryDemo(strokeId);
   // demo.source === "star" → star credit + bilibili/youtube embed
   // demo.source === "coach" → only if published coach library video selected
   ```

3. **参考视频**  
   Use `starDemoForStroke(strokeId)` primary + secondary; Bilibili first in CN.

## Coach library copy

Replace lead that says「学员与分析会优先使用你的材料」with messages from `i18n/messages-star-demos.snippet.ts` (`library.lead`).

## Display name

Default coach: **涨球教练** / **Zhangqiu Coach** (not 掌球 / Poppy / 东东).

## After copy

```bash
cd /opt/tennis-ai && npm ci && npm run build && systemctl restart tennis-ai
```
