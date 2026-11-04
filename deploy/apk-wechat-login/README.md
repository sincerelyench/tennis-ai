# APK 微信登录（对齐 Web / iOS 壳）

产品：**涨球**。Android APK（及共享登录页的 Web / iOS 壳）支持「微信登录」按钮；与小程序共用 `/api/auth/wechat` 会话（`loginWithWeChat` → `wx_<openid>`）。

## 流程

| 端 | 行为 |
| --- | --- |
| Android APK | `ZhangqiuNative.loginWithWeChat()` → OpenSDK `SendAuth`（若配置了 `ZQ_WECHAT_APP_ID`）或 `apk_<androidId>` 回退 → `POST /api/auth/wechat-app` 或 `/api/auth/wechat` |
| iOS 壳 | 同名 JS bridge → `ios_<idfv>` → `/api/auth/wechat` |
| Web 浏览器 | 展示微信按钮；提示到 App / 小程序使用；手机号登录仍可用 |
| 微信小程序 | 由 ZQ-32：`wx.login` → `/api/auth/wechat`（jscode2session） |

## 凭证

- **小程序**（已在生产）：`WECHAT_MP_APPID` / `WECHAT_MP_SECRET`
- **移动应用 OpenSDK**（可选，真·微信授权）：`WECHAT_APP_APPID` / `WECHAT_APP_SECRET`  
  开放平台登记包名 `app.zhangqiu`，签名 MD5：`18ebdb408990a7e30bafd0c43bc7c390`  
  本地打包：`./gradlew assembleRelease -PZQ_WECHAT_APP_ID=wx……`

未配置移动应用 AppID 时，APK 仍完成登录（设备稳定 mock openid），便于联调与演示。

## 发布

```bash
bash deploy/apk-wechat-login/scripts/build-signed-apk.sh
LOCAL_APK=deploy/apk-wechat-login/dist/tennis-ai.apk \
  bash deploy/apk-wechat-login/scripts/mac-four-surface-release.sh
```

版本：**1.0.101 / 201**，签名 alias **ZHANGQIU**，禁止 zip-inject。
