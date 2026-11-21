# ZQ-166 · 小程序暂时去掉微信登录

## Why

Yanqing: 暂小程序上面暂时去掉微信登录。  
Native MP `pages/login` defaulted to **微信登录** tab + one-tap `wx.login` → `/api/auth/wechat`. Keep 账号密码 / 手机验证码.

## Change

- `enableWechatLogin: false` (flip to `true` to restore)
- Default `mode: "password"`
- Hide 微信登录 chip + card
- Expired-session notice no longer mentions 微信登录

H5 `login-view` already hides WeChat outside Zhangqiu iOS shell — **no H5 change**.

## Apply (prod zip)

```bash
bash deploy/mp-hide-wechat-login/scripts/apply-on-server.sh
```

Then: DevTools 清缓存并编译，或重下 `/var/www/apk/mp-weixin.zip`。  
Mac: sync `pages/login/*` into `/Users/yanqing/Downloads/mp-weixin (2)/` when a Mac worker is online.
