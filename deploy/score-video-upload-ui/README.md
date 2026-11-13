# 录入比分：视频上传入口更明显（上传-only）

Yanqing / ZQ-130 follow-up：

1. 「选择视频上传」做成**实心大主 CTA**（h-14、粗体、主色填充 + ring）
2. 去掉录入比分区全部链接/URL 输入与文案（无「视频链接 / 输入链接」）
3. 视频控件区只保留该按钮（选中后可显示文件名）；multipart 上传行为不变

## 改动

- `components/friends-view.tsx`：基于**现网**文件定点改；移除 `scoreHighlightUrlDraft` / URL input；隐藏 file + 实心主按钮
- `lib/i18n/messages.ts`：`highlightFileLabel` →「选择视频上传」；`highlightUrlPlaceholder` 清空（UI 不用）

## Apply

```bash
bash deploy/score-video-upload-ui/scripts/apply-on-server.sh /opt/tennis-ai
```

Code only. No DB changes.

## 四端

Web 为 APK / IPA / 微信小程序 WebView 同源。**原生壳未改** → 部署 Web 后四端同步；无需重打包 APK / IPA。

Preview: `deploy/score-video-upload-ui/preview/index.html`
