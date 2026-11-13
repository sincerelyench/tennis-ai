# 中文版去掉残留英文（ZQ-134）

## What

When `locale=zh`, UI chrome/copy must be Chinese only (no UTR / Universal Tennis / match rating / `(P)` / mixed Latin labels). Rating scale shown as **等级分**. Default locale falls back to **zh** (matches `html lang="zh-CN"`).

## Files

| Path | Change |
| --- | --- |
| `opt-patch/lib/i18n/messages.ts` | zh journey/friends help: UTR→等级分；去掉 match rating / Universal Tennis / `(P)`；补 `profileSetup.wechat*` / `apkHint.*` / `cityResults*` / `winDropWeakHint` |
| `opt-patch/lib/i18n/translate.ts` | SSR/no-navigator default `zh` |
| `opt-patch/lib/i18n/page-meta.ts` | cookie miss → `zh` |
| `opt-patch/components/i18n-provider.tsx` | initial locale default `zh` |
| `opt-patch/components/friends-view.tsx` | remove hardcoded `(P)` marks |
| `opt-patch/components/coach-publish-panel.tsx` | zh stub 去英文 stub/GPU |
| `opt-patch/public/zq-friends-*-inject.js` (+ `assets/`) | CN 分支 UTR→等级分；球员甲/乙 |

## Apply

```bash
bash deploy/cn-english-sweep/scripts/apply-on-server.sh /opt/tennis-ai
```

Code-only (Next build + `tennis-ai` restart). **No production DB writes.**

## Four-surface

- Web: apply → https://yqchen.blog/tennis
- APK / IPA / 小程序：WebView 同源，**无需重打包**
- Note: `/var/www/apk/CN-ENGLISH-SWEEP-NOTE.txt`
