# ZQ-87 修好教练视频指导出结果

## Cause

离开教练页或切到「对话指导」会卸载 `CoachVideoUpload`；未完成的 `taiFetch` 变成 `Failed to fetch`，把 `tennis-coach-active-job-v1` 标成 `error`。回来 resume 直接放弃，消息又不持久 → 「还没有视频指导」。

## Fix

- 卸载 / 瞬时网络错误不再毒化真实 job；保持 `analyzing` 供 resume
- resume 会重试 transient error
- 视频指导气泡写入 `tennis-coach-video-guidance-v1`
- 对话/视频子 tab 用 CSS 隐藏，上传组件保持挂载（关页不中断仍保留）

## Apply

```bash
export SSHPASS=...
bash deploy/coach-video-guidance-fix/scripts/apply-web.sh
```
