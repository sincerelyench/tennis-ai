# 本地列表显示自己（show-self-local-list）

有真实登录 `displayName` 时，本人出现在**当前选中城市**的本地排行（独自一人也为 1）。  
无显示名 → 仍为 **0 / empty**，不用假名。匹配不会选中自己。

位置/城市编辑 UI 由 sibling（profile-change-location）负责；本包不添加「立即保存 / 即使保存」按钮。

## 根因

本人有显示名，但 auth `cityId` 与球友页 IP/所选城市不一致时，`rateLadder` 按城市过滤后变成 0。

## 修复

- `ensureSelfInPlayers`：把本人并入所选城市球员池
- `/api/friends/ladder`：有显示名则写入所选 `cityId`
- Friends / uni-app inject：排行展示自己；匹配排除自己

## 四端

```bash
node deploy/show-self-local-list/scripts/smoke-ensure-self.mjs
bash deploy/show-self-local-list/scripts/build-signed-apk.sh
SSHPASS=… bash deploy/show-self-local-list/scripts/mac-four-surface-release.sh
```

APK **1.0.95 / 195**（assembleRelease + ZHANGQIU，非 zip-inject）。
