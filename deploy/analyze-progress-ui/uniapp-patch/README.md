# Uni-app / APK analysis waiting patch

Goal: while `status` is `submitting|queued|running`, show the same five-step roadmap as web (涨球 brand), wired to `/tai` job fields.

## Do not regress

- Keep `apiStroke` → FormData `stroke` pass-through (serve / fh-topspin fix).
- Do not reintroduce level / NTRP picker on the waiting screen.
- Default coach label remains **涨球教练**.

## Fields to read from `GET …/api/jobs/{id}` (or `/tai/api/jobs/{id}`)

| Field | Use |
| --- | --- |
| `step` / `step_name` | Active roadmap card |
| `progress` | Percent (cap 99 until done) |
| `eta_steps[]` | Per-step ETA labels |
| `eta_hint` / `eta_remaining_s` | “大约还要 X 分钟” + leave note |
| `preview_rev` | Preview image URL |
| `source_name` | Filename under 当前步骤 |
| `message` | Status headline |

## Markup sketch

Use `progress-roadmap.wxml.txt` / inject the block from `progress-roadmap.snippet.vue` above the existing percent card (or replace it). Keep `data-analyze-progress` attributes for QA.

## Local preview while uploading

If the client already holds a temp file / blob path, show that in 分析预览 immediately; switch to `/tai` preview when `preview_rev` arrives.
