# ZQ-88 去掉视频指导空态文案

## Cause

视频指导子 tab 在尚无 AI/网络指导气泡时，底部渲染 `EmptyState`（「还没有视频指导」/ "No video guidance yet"）。用户要求：没有真实指导内容时不要展示该空态块。

## Fix

- 删除 `coach-view.tsx` 视频结果区的 `EmptyState` 分支
- 有 `videoMessages` / `videoBoard` 内容时仍照常展示气泡与留言板
- 基于 ZQ-87（#97）补丁；生产已有 persist 修复时只需覆盖 `coach-view.tsx`

## Apply

```bash
export SSHPASS=...
bash deploy/hide-empty-video-guidance/scripts/apply-web.sh
```
