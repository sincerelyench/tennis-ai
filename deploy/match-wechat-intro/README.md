# 球友：匹配成功微信引导 + 取消后重匹配/搜索挑战

产品：**涨球**。

## 改动

1. 附近匹配成功后，双方看到引导消息：互相加微信，自行约定场地和时间（应用内不订场）。
2. 对方未回复时可「取消」，结束该 pending 配对。
3. 取消后提供「重新开始匹配」或「搜索球友并挑战」。
4. 搜索挑战：找到球员并发起挑战；对方接受后走同一微信约球引导。

## 文案

- ZH：`匹配成功，请互相加微信，再自行约定场地和时间。`
- EN：`Match successful. Please add each other on WeChat, then arrange the venue and time yourselves.`

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` + `/api/friends/intros` |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.96**（禁止 zip-inject） |
| iOS IPA | 同 www inject 嵌入壳 |
| 微信小程序 | `FRIENDS-MATCH-WECHAT-INTRO-NOTE.txt` + zip 刷新 |

## 部署

```bash
bash deploy/match-wechat-intro/scripts/build-signed-apk.sh
SSHPASS=… bash deploy/match-wechat-intro/scripts/mac-four-surface-release.sh
```
