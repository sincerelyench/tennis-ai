# 安卓手机网页提示下载 APK

## 目标

- 安卓**手机**浏览器 / 非涨球壳 WebView 访问 `yqchen.blog/tennis` 时，软提示下载现网 APK。
- 不打扰：iOS、桌面、已在 `ZhangqiuAndroid` 原生壳内。
- 文案中文匹配涨球语气；英文 locale 有对应键。
- APK 地址沿用现网：`https://yqchen.blog/tennis-ai.apk`（`/var/www/apk/tennis-ai.apk`）。

## 改动

| 文件 | 作用 |
| --- | --- |
| `lib/android-apk.ts` | UA 判定 + 现网 URL + dismiss localStorage |
| `components/android-apk-hint.tsx` | 可关闭横幅 + 登录/我的常驻链 |
| `components/app-shell.tsx` | 登录后页顶部横幅 |
| `components/login-view.tsx` | 登录旁轻量链 |
| `components/profile-view.tsx` | 「我的」设置区常驻入口 |
| `lib/i18n/messages.ts` | `apkHint.*` 中英 |

## 四端

- **Web**：本补丁。
- **APK / IPA / 小程序**：WebView 同源；壳未重打；壳内 UA 自动隐藏提示。NOTE → `/var/www/apk/ANDROID-APK-DOWNLOAD-HINT-NOTE.txt`。

## 发布

```bash
SSHPASS=… bash deploy/android-apk-download-hint/scripts/apply-on-server.sh
```

无数据库写入。
