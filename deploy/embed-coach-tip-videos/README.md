# 对话指导：内嵌可播放讲解视频

基于 `coach-dialog-video-tabs`（PR #80）。

## UX

1. **对话指导**回答附带的讲解视频在页内可直接播放（不再只给搜索链接）
   - 中文：B站原片链接 + 站内 tip 短片；小红书用站内 tip 短片（平台无公开 iframe）
   - 英文：YouTube iframe
2. **网络教练空态**：头部只显示「无教练」，去掉风格 / 默认人格 / 等发布等长文案
3. **「网络教练留言」**：仅在已选择真实网络教练时展示；空态整块隐藏

## Apply

```bash
bash deploy/embed-coach-tip-videos/scripts/apply-on-server.sh /opt/tennis-ai
```

Does **not** touch `lib/feature-flags.ts`（分析 tab 保持隐藏）。
