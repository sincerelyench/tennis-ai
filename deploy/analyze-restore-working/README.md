# Restore working analyze (past 2% + 10s clip)

## Problem
Uploads stuck at ~2% (`submitting`). Phones aborted large POSTs (`499`). A prior change set `CLIP_MAX_SEC = Infinity`, so users could select/upload clips longer than the working 10s window.

## Restore (live applied)
1. `lib/clip.ts` → `CLIP_MAX_SEC = 10` (from video-clip-duration backup)
2. Revert busy-precheck / video-last FormData in `analysis-view.tsx` + simple `pingTai()` boolean (`tai.ts` keeps 900s timeout)
3. Keep auth cache-miss reload + `force-dynamic` on main layout
4. Keep nginx `/tai` `proxy_request_buffering off` and GPU busy reap

## Proof
- Job `2ef3a15c7ffd`: 10s clip → `job_id` returned → `done` progress 100, score 42
- Media: `analyze-restore-working/`
