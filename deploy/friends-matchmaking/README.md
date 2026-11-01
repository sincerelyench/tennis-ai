# 球友：王者荣耀式附近匹配

产品：**涨球**。

## 改动

1. **匹配约球**：按自评水平 / 城市 / 类 UTR 匹配一位合适附近球友（同城优先，邻近城市兜底），搜索动画后出结果。
2. **保留**城市排行 + 录入比分。
3. **不恢复**搜索球友 / 搜索球场。

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `web-patch` → `/opt/tennis-ai` FriendsView + `/lib/matchmaking.ts` |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.93**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | `FRIENDS-MATCHMAKING-NOTE.txt` + zip 刷新 |

## 部署

```bash
bash deploy/friends-matchmaking/scripts/build-signed-apk.sh
bash deploy/friends-matchmaking/scripts/mac-four-surface-release.sh
```

## 证据

`media/friends-matchmaking-20261102/`
