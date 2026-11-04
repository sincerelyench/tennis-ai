# 微信小程序：web-view 对齐网页

产品：**涨球**。原生仅保留微信登录壳；登录后用 `<web-view>` 打开 `https://yqchen.blog/tennis`，与 APK/IPA 同源，杜绝四 tab 原生漂移。

## 登录桥接

1. 小程序 `wx.login` 拿 `code`
2. `POST https://yqchen.blog/tennis/api/auth/wechat` → `token`
3. web-view 打开 `GET /api/auth/mp-enter?token=…` → 写 `tennis_session` cookie → 跳转 `/tennis`

## 发布

```bash
# 服务端补丁（mp-enter + middleware）
# 在已 ssh 的机器上：
bash deploy/mp-align-webview/scripts/apply-on-server.sh

# 打包并上传 zip
bash deploy/mp-align-webview/scripts/ship-mp.sh
```
