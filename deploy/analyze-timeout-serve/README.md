# Analyze timeout on 发球 (serve)

## Symptom

UI: **分析未完成 — 分析服务超时。请换一条更短的侧面视频。** (`error.serviceTimeout`)
Stroke: 发球. Nginx shows client `499` on `POST /tai/api/analyze` for phone browsers while GPU is single-worker busy (or mid-upload abort).

## Root cause

1. GPU `/api/analyze` is single-worker. Coaching LLM can hold the slot ~2–3 minutes.
2. FastAPI only runs the busy check **after** the full multipart body is read, and the Next client put `video` first — phones abort mid-upload → `AbortError` → `error.serviceTimeout` (misleading vs true busy).
3. Live GPU lacked stale-job reap / `busy_job` on health; Next `pingTai()` only checked `ok`, not `busy`.

## Fix (this branch + live hotfix)

**GPU** (`47.93.203.28`):

- Reap zombie queued/running jobs (`TAI_STALE_JOB_S`, default 1200s)
- Expose `busy` + `busy_job` on `/api/health` and 409 responses
- Soft-fail Cursor coaching so a hung agent still finishes scores and frees the worker

**Blog Next** (`/opt/tennis-ai`):

- `pingTai()` returns `{ ok, busy, busyJob }`
- Submit fails fast with `error.busy` when GPU busy (no upload)
- FormData appends `video` last

Apply scripts: `scripts/apply-on-gpu.sh`, `scripts/apply-on-server.sh`.

## Proof

- Job `f2bc714e972d` stroke=serve → `done` score=38 coach=FINISHED
- Evidence: media store `analyze-timeout-serve/` (probes + browser screenshots)
