# 对话指导：内嵌可播放讲解视频

基于 `coach-dialog-video-tabs`（PR #80）。

## UX

1. **对话指导**附带**真实平台**讲解（禁止 `/tennis/examples` 演示片）
   - 中文：B站真实 BV（官方播放器内嵌 + 原链接）；小红书真实主页/笔记链接（平台无公开 iframe）
   - 英文：YouTube iframe
2. **网络教练空态**：头部只显示「无教练」，去掉风格 / 默认人格 / 等发布等长文案
3. **「网络教练留言」**：仅在已选择真实网络教练时展示；空态整块隐藏

## Apply

```bash
bash deploy/embed-coach-tip-videos/scripts/apply-on-server.sh /opt/tennis-ai
```

Does **not** touch `lib/feature-flags.ts`（分析 tab 保持隐藏）。
