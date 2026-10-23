# 球友：去掉搜索残留 + 录入比分

产品：**涨球** / **涨球教练**。UTR ladder 保留；不恢复 NTRP。

## 改动

1. **Web** `/tennis/friends`：`friends-view.tsx` 增加球员名 + 盘分录入，历史存 `localStorage`（`zq-match-scores-v1`）。清理 `searchPh` / `searchAria` 残留键，并把 `lib/messages.ts` 球友文案里的 NTRP 改成 UTR。
2. **uni-app www**（APK / IPA）：去掉球友页搜索框；i18n 清空「搜索球友或球场」；列表 NTRP→UTR；注入 `zq-friends-score-inject.js` 录入比分。
3. **mp-weixin** 薄包本身无球友搜索页；随四端刷新 zip。

## 部署

```bash
# Web
scp -r deploy/friends-score-entry root@8.216.53.29:/tmp/friends-score-entry
ssh root@8.216.53.29 'bash /tmp/friends-score-entry/scripts/apply-on-server.sh'

# APK：把 uniapp-www 合入 android assets 后 Gradle assembleRelease（禁止 zip-inject）
# IPA：更新 Payload/.../www 后按现有 build-ipa / 重打流程
```

## 证据

`media/friends-score-entry-20261023/`
