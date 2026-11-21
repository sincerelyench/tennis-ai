# ZQ-166 / 166b · 小程序去掉微信登录

## Why

Yanqing: 去掉小程序微信登录。  
Native MP `pages/login` had **微信登录** tab + `wx.login` → `/api/auth/wechat`. Keep 账号密码 / 手机验证码 only.

## Change (166b hard remove)

- Login mode chips: **账号密码** + **手机验证码** only（无微信登录）
- Removed `onWechatLogin` / WeChat card from UI
- Default `mode: "password"`
- Expired-session notice → 账号密码或手机验证码

H5 `login-view` already hides WeChat outside Zhangqiu iOS shell — **no H5 change**.

## Apply (prod zip)

```bash
bash deploy/mp-hide-wechat-login/scripts/apply-on-server.sh
```

Then: DevTools **清缓存并编译**，或重下 `/var/www/apk/mp-weixin.zip`。  
Mac: sync `pages/login/*` into `/Users/yanqing/Downloads/mp-weixin (2)/` when a Mac worker is online.
