# 我的 · 去掉训练计划 / 每周训练

产品：**涨球**。在「我的 / Profile」移除训练相关入口与区块。

## 行为

1. 设置菜单去掉「训练计划」(`/plan`) 与 EN「Training plan」
2. 「我的数据」去掉「本周训练天数 / 每周的训练」卡片与 WeekStrip
3. 通知页去掉指向 `/plan` 的每周训练条目；`/plan` 重定向到「我的」
4. 保留城市编辑；设备入口由 devices peer 处理

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` ProfileView / notices / plan redirect |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.96**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | note + zip 刷新 |

## 部署

```bash
bash deploy/remove-profile-training/scripts/build-signed-apk.sh
bash deploy/remove-profile-training/scripts/mac-four-surface-release.sh
```

## 证据

Project store: `media/remove-profile-training/`
