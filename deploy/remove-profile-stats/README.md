# 我的 · 去掉统计条与趋势卡

产品：**涨球**。在「我的 / Profile」移除冗余统计。

## 行为

1. 去掉顶部统计条：训练时长 / 球友个数 / 分析个数（及 EN Training duration / Friends / Analyses）
2. 去掉「练的最多 / Most practiced」与「最近趋势 / 近期等级走势 / Recent grade trend」卡片
3. 不留空白占位；保留城市编辑、设置（无设备、无训练计划）、成长轨迹入口、品牌涨球

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` ProfileView |
| Android APK | inject + `assembleRelease` **1.0.97**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | note + zip 刷新 |

## 部署

```bash
bash deploy/remove-profile-stats/scripts/build-signed-apk.sh
bash deploy/remove-profile-stats/scripts/mac-four-surface-release.sh
```

## 证据

Project store: `media/remove-profile-stats/`
