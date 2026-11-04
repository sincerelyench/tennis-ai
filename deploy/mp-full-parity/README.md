# 微信小程序：微信登录 + 四 tab 全功能

产品：**涨球**。覆盖网页同构四 tab：分析 / 约球 / 教练 / 我的。覆盖此前「小程序仅约球」范围。

## 登录

1. 小程序 `wx.login` 拿 `code`
2. `POST https://yqchen.blog/tennis/api/auth/wechat`
3. 服务端 `WECHAT_MP_APPID` + `WECHAT_MP_SECRET` → `jscode2session`（失败/测试码 → wechat-mock）

## 发布

```bash
bash deploy/mp-full-parity/scripts/ship-mp.sh
```

会打包 `miniprogram/` → `/var/www/apk/mp-weixin.zip` 与 README。
