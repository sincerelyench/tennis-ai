# ZQ-89 · 收紧离开 Tab「视频正在上传中」

## Must

1. 教练视频**正在上传字节或分析进行中**时，离开教练底栏 Tab **必须**弹「视频正在上传中」并拦截跳转（有意为之）。
2. 空闲 / 从未上传 / 已完成 → 切 Tab **绝不**弹窗。
3. **通知**入口永不被该弹窗拦截（随时可打开）。

## Changes

| File | What |
| --- | --- |
| `app-shell.tsx` | 去掉通知铃铛上的 submit-lock；底栏锁仅 `coachBusy && onCoachTab`；不再用 analysis job-watch 挡导航 |
| `coach-active-job.ts` | `pending-*` 仅在本 tab `sessionStorage` 会话内算上传中；过期/孤儿锁自愈 |

## Apply

```bash
export SSHPASS=...
bash deploy/leave-tab-dialog-tighten/scripts/apply-web.sh
```

## Prove

- 空闲约球↔教练↔我的：无 dialog
- 空闲点通知铃铛：进入 `/notices`
- 仅上传/分析中离开教练：出现「视频正在上传中」
