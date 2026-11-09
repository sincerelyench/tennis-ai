# 教练 tab：视频指导 + 改进计划

## Product

- 教练页顶部分区两个子 tab：**视频指导** / **改进计划**
- **视频指导**：上传约 10 秒挥拍 → tai/sslip `/tai/api/analyze`（非 iframe）→ 结果在涨球教练对话气泡；同步留言给已选网络教练
- **改进计划**：涨球教练改进计划 UI（确认计划、分步练习、当前任务）
- 普通聊天可后续并入改进计划；本版只做这两 tab
- 品牌名：**涨球教练**；底部「分析」tab 保持隐藏（`SHOW_ANALYSIS_TAB` 不动）
- 中文界面只出中文文案

## Patch files

- `opt-patch/components/coach-view.tsx` — 双分区主 UI
- `opt-patch/components/coach-video-upload.tsx` — 上传 / 裁剪 / 轮询（沿用）
- `opt-patch/lib/coach-video-guidance.ts` — 分析结果文案（沿用）
- `opt-patch/lib/i18n/messages.ts` — `coach.videoGuidance` / `coach.mainTabsAria`
- `preview/index.html` — 免登录示意
- `scripts/apply-on-server.sh` — 部署到 `/opt/tennis-ai`

## Apply

```bash
bash deploy/coach-dual-subtabs/scripts/apply-on-server.sh /opt/tennis-ai
```

Live: https://yqchen.blog/tennis/coach  
Preview: https://yqchen.blog/coach-dual-subtabs.html
