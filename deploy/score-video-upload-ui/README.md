# 录入比分：视频上传入口更明显（上传-only）

Yanqing / ZQ-130：

1. 「选择视频上传」做成醒目 CTA（不再埋在原生 file 控件里）
2. 去掉录入比分区的「视频链接 / 输入链接」路径与文案，仅本地上传
3. 上传行为不变：选文件后随比分 POST multipart 到 `/api/friends/scores/[id]/highlight`

## 改动

- `components/friends-view.tsx`：移除 `type="url"` 链接输入与 `scoreHighlightUrlDraft`；隐藏 file input + 主色描边按钮「选择视频上传」；选中后显示文件名
- `lib/i18n/messages.ts`：`highlightFileLabel` →「选择视频上传」；新增 `highlightFileHint`；`highlightUrlPlaceholder` 不再写链接文案（UI 已不用）

## Apply

```bash
bash deploy/score-video-upload-ui/scripts/apply-on-server.sh /opt/tennis-ai
```

Code only. No DB changes.

## 四端

Web 为 APK / IPA / 微信小程序 WebView 同源。本改动仅 Next UI 文案与控件，**原生壳未改** → 部署 Web 后四端同步；无需重打包 APK / IPA（壳未变）。mp-weixin 若走同一 `/tennis` WebView 亦随 Web 生效。

Preview: `deploy/score-video-upload-ui/preview/index.html`
