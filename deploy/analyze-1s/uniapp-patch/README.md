# uni-app patch notes (APK / IPA / mp-weixin)

Apply on `8.216.53.29:/opt/tennis-ai/apps/uniapp` (or local checkout), then rebuild all three native packs.

## Required behavior

1. **Poll `/tai` (or proxied analyze job) every 250ms** while status is queued/running (was often 1–2s).
2. On analyze response: if `cached === true`, navigate straight to result (skip waiting UI).
3. When local video `duration ≤ 6`, send form field `fast=1`.
4. Keep `stroke` / `apiStroke` as selected (`serve` must not become `fh-topspin` before submit).
5. Prefer server `eta_steps` / `eta_hint` / `analyze_mode` over hardcoded “3–6 分钟”.

## Patch helper

`scripts/apply-web.sh` runs `patch-uniapp-poll.py` which:

- Replaces common poll intervals `2000`/`1500`/`1000` used next to `/api/jobs` or analyze polling with `250` in `src/pages/analysis/**` and related libs.
- Ensures `fast` is appended when duration ≤ 6 in upload FormData builders.

If the live tree already uses `ANALYZE_POLL_MS` from `lib/job-progress.ts`, importing that constant is enough.
