# 演示视频去文字（涨球 · 四端）

## 目标

拍摄示例 / 正确动作卡片：**只留可播球星画面**。技术下拉保留。

去掉：署名、页脚「打开B站原页」「换源 · YouTube」、其它源切换文案。

片源仍用 HD 球星 embed（B站 `high_quality=1` 优先）。品牌 **涨球**；教练 **涨球教练**。

## 接线

- Next：`<StarDemoPlayer strokeId={…} />` — 覆盖 `components/star-demo-player.tsx`
- uni-app：同名 vue 组件；小程序走 `pages/star-demo-embed`
- 勿在 player 外包 credit / 换源

## 四端应用

```bash
# Mac（推荐）
bash deploy/demo-video-clean/scripts/mac-four-surface-release.sh

# 或服务器
bash deploy/demo-video-clean/scripts/apply-on-server.sh /opt/tennis-ai
```

验证：Web / APK / IPA / mp-weixin.zip 均无署名与换源入口。
