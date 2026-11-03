# 我的 · 改当前位置 / 城市

产品：**涨球**。在「我的 / Profile」修改当前位置城市。

## 行为

1. Profile 展示当前位置，下拉切换城市（中文仅中国；英文含全球）
2. 切换即时 `PATCH /tennis/api/auth/profile` → `cityId`
3. 同步 `localStorage zq-friends-city-v1`，球友排行 / 匹配跟新城市
4. 默认：auth city → 本机存储 → IP geo → 无锡

## 协调

Sibling `bc-fdb7f098`（本地列表显示自己）依赖同一 `cityId`；本包只负责 Profile 写入与四端 UI。

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` ProfileView + cities |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.95**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | note + zip 刷新 |

## 部署

```bash
bash deploy/profile-change-location/scripts/build-signed-apk.sh
bash deploy/profile-change-location/scripts/mac-four-surface-release.sh
```

## 证据

`media/profile-change-location-20261104/`
