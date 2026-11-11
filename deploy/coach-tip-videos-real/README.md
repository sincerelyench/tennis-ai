# 对话指导 · 真实平台讲解视频（ZQ-74）

## 问题

用户在「对话指导」仍看到演示/占位 tip 视频，或中文输入落到 YouTube / 本地 `/tennis/examples` mp4。

## 修复

- `lib/coach.ts`：真实 BV + 小红书；`resolveCoachLocale` / `tipVideoLocale` — 中文输入强制中文平台
- `app/api/coach/chat/route.ts`：按消息/ cookie / Accept-Language 解析 locale；禁止 demo 文案
- `components/coach-tip-video.tsx`：B站/YouTube iframe；小红书外链卡；拒本地 demo
- `components/coach-view.tsx`：过滤 demo payload；中文 tip 强制 zh；重新挂上真实平台 tip 卡
- `components/coach-picker.tsx`：技术 tip 芯片改真实平台，去掉 `<video src=/tennis/examples…>`

## 部署

```bash
bash deploy/coach-tip-videos-real/scripts/apply-on-server.sh /opt/tennis-ai
```

Live: https://yqchen.blog/tennis/coach  
Preview: https://yqchen.blog/coach-tip-videos-real.html
