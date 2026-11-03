# 球友录入比分 · 对方确认后进排行/UTR

产品：**涨球**。

## 行为

1. 录入比分 → 服务端 `pending`（**不**改排行 / UTR）
2. 对方确认 → `confirmed` → 刷新 ladder / UTR
3. 对方拒绝 → `rejected`，不进系统
4. 无真实登录用户 → 目录 / 排行 / 匹配显示 **0**（不造假名）

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` FriendsView + scores APIs |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.94**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | `FRIENDS-SCORE-CONFIRM-NOTE.txt` + zip 刷新 |

## 协调

与 `bc-d575d106`（真实登录名 / empty=0）共享 friends 面；本包含其 directory/ladder/auth 基线 + 比分确认。

## 部署

```bash
bash deploy/friends-score-confirm/scripts/build-signed-apk.sh
bash deploy/friends-score-confirm/scripts/mac-four-surface-release.sh
```

## 证据

`media/friends-score-entry-sync-20261104/`
