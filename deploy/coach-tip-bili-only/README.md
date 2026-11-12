# 对话指导 · 去掉小红书只留 B站（ZQ-80）

## 问题

对话指导 tip 仍展示小红书外链卡（无法页内嵌入）。

## 修复

- `lib/coach.ts`：中文 tip 只返回 B站；去掉 `xiaohongshu` 平台与数据
- `components/coach-tip-video.tsx`：只渲染 B站 / YouTube；过滤小红书
- `components/coach-view.tsx`：payload 再滤一遍 XHS / demo
- `components/coach-picker.tsx`：tip 芯片注释改为 B站 / YouTube
- `app/api/coach/chat/route.ts`：系统提示改为中文只附 B站

## 部署

```bash
bash deploy/coach-tip-bili-only/scripts/apply-on-server.sh /opt/tennis-ai
```

Live: https://yqchen.blog/tennis/coach  
Preview: https://yqchen.blog/coach-tip-bili-only.html
