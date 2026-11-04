# 底栏：约球 ↔ 教练换位

产品：**涨球**。第三 tab「球友」改名「约球」（EN **Play**），并与第二 tab「教练」对调。

## 行为

1. 球员底栏顺序：`分析` → `约球` → `教练` → `我的`
2. EN：`Analyze` → `Play` → `Coach` → `Me`
3. 约球仍绑定原球友/匹配（`/friends`）；教练仍为教练内容，仅换位
4. 无中英混排；品牌「涨球」

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` AppShell + messages |
| Android APK | bundle 改序 + inject + `assembleRelease` **1.0.97** |
| iOS IPA | 同 www inject / bundle 刷新壳 |
| 微信小程序 | note + zip 刷新 |

## 部署

```bash
bash deploy/tabs-swap-yueqiu/scripts/build-signed-apk.sh
bash deploy/tabs-swap-yueqiu/scripts/mac-four-surface-release.sh
```

## 证据

Project store: `media/tabs-swap-yueqiu/`
