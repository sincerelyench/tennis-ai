# 教练 tab：上传视频求双通道指导

## Product

- 入口在 **教练** tab（不恢复底部「分析」tab；`SHOW_ANALYSIS_TAB` 不动）
- 用户上传约 10 秒挥拍 → 调用 **tai / sslip 分析 API**（`/tai/api/analyze`，与 `https://tennis.47.93.203.28.sslip.io/` 同源后端），**不 iframe 该网页**
- 结果写入 **涨球教练** 对话气泡（对齐八项技术要领）
- 同一段视频同时写入所选 **网络教练** 留言板，等待真人回复

## Patch files

- `opt-patch/lib/coach-video-guidance.ts` — 结果 → 对话文案 / 八项映射
- `opt-patch/components/coach-video-upload.tsx` — 选动作 / 选片 / 裁剪 / 上传 / 轮询 / 空·载·错态
- `opt-patch/components/coach-view.tsx` — 接入上传区与双通道投递
- `preview/index.html` — 免登录示意页
- `scripts/apply-on-server.sh` — 部署到 `/opt/tennis-ai`

## Apply

```bash
bash deploy/coach-video-guidance/scripts/apply-on-server.sh /opt/tennis-ai
```

Live: https://yqchen.blog/tennis/coach  
Preview: https://yqchen.blog/tennis/coach-video-guidance.html
