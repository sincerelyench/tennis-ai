# Submission timeout again

## Root cause

At 28%「服务器接收中」the XHR had finished sending bytes and was waiting for `job_id`. Huawei session `103.121.208.60` at **16:42:18** soft-navigated to `/tennis/friends` (bottom nav) → browser aborted POST → nginx **499**. UI then showed English `Submit timed out...` because `locale=en` while progress copy was hardcoded Chinese.

## Fixes

1. **Block bottom nav / notices** while `job-watch` phase is `submitting` (Chinese alert).
2. **leaveHint during submit**: 「上传完成前请留在本页…」
3. **ZH-only** for submit/timeout/abort errors (force `messages.zh`).
4. Pending submit watchdog **3 → 15 min**.
5. GPU busy middleware: remove full-body drain; `Connection: close` on 409.
