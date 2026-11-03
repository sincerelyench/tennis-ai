# 上传选段 · 默认/最短 10 秒，可拖长

产品：**涨球**。分析上传选段窗行为调整。

## Behavior

1. **Default** = 10 seconds when source ≥ 10s
2. Source **< 10s** → select entire video (min = max = full)
3. User may **drag longer** up to full source length
4. **Minimum** remains 10s when source ≥ 10s (cannot shrink below)

## Surfaces

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` `lib/clip.ts` + i18n |
| Android APK | uni www bundle patch + `assembleRelease` **1.0.98**（禁止 zip-inject） |
| iOS IPA | same www bundle in WebView shell |
| 微信小程序 | note + zip 刷新（小程序无胶片选段窗，整段上传） |

## Deploy

```bash
bash deploy/video-clip-duration/scripts/build-signed-apk.sh
bash deploy/video-clip-duration/scripts/mac-four-surface-release.sh
```

## Evidence

Project store: `media/video-clip-duration/`
