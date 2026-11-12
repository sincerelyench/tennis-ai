# ZQ-85 · Tab 切换误弹「视频正在上传中」

## Bug

Idle 约球 / 我的 / 教练切换也会弹出上传中对话框。

## Fix

1. `app-shell.tsx`：对话框仅在 **当前位于教练 Tab** 且教练视频上传/分析进行中、用户点其它底栏时出现；约球↔我的↔教练（空闲）不弹。
2. `coach-active-job.ts`：`isCoachSubmitLocked` 以真实 job phase 为准，并修复孤儿 `LOCK_KEY=1`。
3. `coach-video-upload.tsx`：`fail()` 一律把 job 标成 error 以清锁。

## Apply

```bash
export SSHPASS=...   # voice-diary-prod-ssh
bash deploy/tab-upload-dialog-fix/scripts/apply-web.sh
```

## Verify

1. 清空 / 无 `tennis-coach-active-job-v1` 时，在约球点教练 / 我的：无 alert。
2. 强制 `localStorage.tennis-coach-submit-lock-v1="1"` 后刷新约球，切换 Tab：仍无 alert（孤儿锁自愈）。
3. 教练「视频指导」上传中离开底栏：出现「视频正在上传中」。
