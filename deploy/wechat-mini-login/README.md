# 微信小程序：微信登录 + 仅约球

产品：**涨球**。mp-weixin 先只开放约球；分析 / 教练 / 我的不进小程序。

## 登录

1. 小程序 `wx.login` 拿 `code`
2. `POST https://yqchen.blog/tennis/api/auth/wechat`  
   Body: `{ "code": "...", "nickName": "可选微信昵称" }`
3. 服务端用 `WECHAT_MP_APPID` + `WECHAT_MP_SECRET` 调 `jscode2session`  
   - 有密钥且成功 → 真实 openid 会话  
   - 无密钥 / tourist 码失败 → 确定性 mock openid（`wechat-mock`），本地可联调
4. 账号键 `wx_<openid>`，绑定涨球 session；`displayName` 优先已有真实登录名，空时用微信昵称

## 配置

systemd drop-in（`apply-on-server.sh` 可自动写）：

```
Environment=WECHAT_MP_APPID=wx……
Environment=WECHAT_MP_SECRET=……
```

小程序 `project.config.json` 的 `appid` 须与密钥对应；测试号 / `touristappid` 走 mock。

## 发布

```bash
# 服务器 API
bash deploy/wechat-mini-login/scripts/apply-on-server.sh

# 打包 mp-weixin.zip（仓库 miniprogram/）
cd miniprogram && zip -qr /tmp/mp-weixin.zip . -x '*.DS_Store*'
# 上传到 /var/www/apk/mp-weixin.zip
```

Web / APK / IPA 仍为完整四 tab，本变更只动小程序 + 登录 API。
