# Upload stuck (~2%) deepdive

## Root cause

Upload looked “卡住” because the client froze the progress UI at **2%** for the entire trim→POST→GPU wait, while phones often **reload** mid-POST (nginx **499**). GPU nginx also had **`proxy_request_buffering on`**, so `job_id` waited on a full body disk buffer after the blog already streamed.

## Fixes

| Layer | Change |
| --- | --- |
| Client `tai.ts` | `taiUpload` via XHR `upload.onprogress` |
| Client `analysis-view.tsx` | Paint submit progress 2→28% + “正在上传视频…” |
| Client `trim-file.ts` | Copy-first remux; transcode only if copy fails |
| GPU nginx | `proxy_request_buffering off` (match blog `/tai`) |
| GPU `analyze_busy_guard` | Drain body before 409 so stream does not hang |

## Apply

```bash
# GPU 47.93.203.28
bash deploy/upload-stuck-deepdive/scripts/apply-on-gpu.sh

# Blog 8.216.53.29
bash deploy/upload-stuck-deepdive/scripts/apply-on-blog.sh
```
