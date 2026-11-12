# 网页版去掉微信登录 + 默认先注册

## 目标（ZQ-83 / ZQ-84）

- 浏览器打开 `yqchen.blog/tennis/login`：**不**再显示微信登录按钮/流程
- 新用户默认落在 **注册** tab（注册在左、登录在右；`data-auth-default="signup"`）
- 保留：用户名密码、手机号验证码、注册流程
- **不**改 APK / iOS 壳内微信登录（`ZhangqiuAndroid` / `ZhangqiuIOS` UA 仍显示绿色微信按钮）
- **不**改微信小程序：`wx.login` → `/api/auth/wechat` / `mp-enter` 仍可用

## 改动

只补丁 `/opt/tennis-ai/components/login-view.tsx`：

- `isZhangqiuShell()` 为真时才渲染 `data-wechat-login`
- `startWechatLogin` 在非壳环境直接 return
- `authTab` 初始值改为 `signup`；tab 顺序注册优先
- `/api/auth/wechat*`、`loginWithWeChat`、Android OpenSDK **未动**

## 发布

```bash
SSHPASS=… bash deploy/web-no-wechat-login/scripts/apply-on-server.sh
# 或
scp -r deploy/web-no-wechat-login root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/web-no-wechat-login/scripts/apply-on-server.sh /opt/tennis-ai'
```

预览说明页：`deploy/web-no-wechat-login/preview/web-no-wechat-login.html` → `/var/www/apk/web-no-wechat-login.html`
