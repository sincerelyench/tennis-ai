# 教练页：对话指导 + 视频指导

Supersedes dual-subtabs（视频指导/改进计划）与窄范围「精简头部」工作。

## UX

1. **紧凑头部**：`AI 教练` + 可选 `真实网络教练`（不要「掌球教练」；产品品牌别处仍可叫涨球教练）
2. **两个子 tab**
   - **对话指导**：自由说想学什么；AI 正常回答，并附最匹配视频讲解
   - **视频指导**：上传挥拍/比赛视频；调用 sslip `/tai` 分析 API，结果在站内对话 UI（无 iframe 外站页）
3. **视频讲解来源**
   - 中文：小红书 + B站
   - 英文：YouTube

## Apply

```bash
bash deploy/coach-dialog-video-tabs/scripts/apply-on-server.sh /opt/tennis-ai
```

Does **not** touch `lib/feature-flags.ts`（分析 tab 保持隐藏）。
