# 设置里去掉设备

产品：**涨球**。从「我的 / Profile」设置列表移除「设备 / Devices」，并让 `/devices` 回到我的。

## 行为

1. Profile 设置菜单不再含 `profile.devices` / `/devices`
2. 访问 `/tennis/devices` → 软跳回「我的」(`/`)
3. AppShell 不再把 `/devices` 算作「我的」子路由高亮
4. Uniapp / WebView inject 隐藏设备行并拦截 device 页

## 协调

| Peer | Scope |
| --- | --- |
| `bc-917184bb` Profile change location | 城市编辑器 / `cityId`（本包保留） |
| `bc-44816422` Remove profile training | 「训练计划」+ 本周训练区块（本包不碰） |

本包只删设备入口与页面；合并时：保留 city + 去掉 devices +（若 training 已落地）去掉 plan/week。

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` ProfileView + devices redirect |
| Android APK | inject + `assembleRelease` **1.0.96**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | note + zip 刷新 |

## 部署

```bash
bash deploy/remove-settings-devices/scripts/build-signed-apk.sh
bash deploy/remove-settings-devices/scripts/mac-four-surface-release.sh
```

## 证据

`media/remove-settings-devices-20261104/`
