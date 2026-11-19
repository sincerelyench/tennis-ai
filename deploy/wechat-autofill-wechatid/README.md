# ZQ-157 · 微信登录：微信号勿写 openid；显示名默认微信名

Fixes wrong 「我的」微信号 after WeChat MP login (ZQ-149/151 wrote openid into `wechatId`).

Builds on ZQ-153 displayName←nickName kit path. Re-apply this kit on prod to stop openid-as-微信号.

## Behavior (`POST /api/auth/wechat`)

| Field | When empty / placeholder | When user already set a real value |
| --- | --- | --- |
| **微信号** `wechatId` | **留空**（官方 API 无真实微信号；**不写 openid**） | **不改**（自定义不覆盖） |
| **显示名** `displayName` | 默认用登录 body 的微信名 `nickName` | **不改** |

### 微信号（ZQ-157）

- 官方小程序 API **拿不到**真实微信号字符串；openid / unionid / nickName **都不是**约球用的微信号。
- 登录 / `getSession` **不再**把 openid 写入 `wechatId`。
- 若库里已有 ZQ-149/151 的 openid 派生污染（`wechatId === sanitize(openid)` 或同 hash），登录或拉 session 时**惰性清空**；**不会**批量抹掉用户手填的自定义微信号。
- `needsProfileSetup` / 约球门闩要求**真实** `wechatId`（openid 绑定不够）。

### 显示名（ZQ-153 保留）

- 新账号：`displayName = sanitize(nickName)`（可为空）
- 已有账号：仅当现名 blank / 被 sanitize 掉 / 占位（如「微信用户」）时写入 nick
- `needsProfileSetup` 也把占位显示名当未完善

## Apply (prod)

Host: `root@8.216.53.29` `/opt/tennis-ai`

```bash
bash deploy/wechat-autofill-wechatid/scripts/apply-on-server.sh /opt/tennis-ai
```

Mac（Keychain）:

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e ssh root@8.216.53.29 'rm -rf /tmp/wechat-autofill-wechatid'
sshpass -e scp -r deploy/wechat-autofill-wechatid root@8.216.53.29:/tmp/wechat-autofill-wechatid
sshpass -e ssh root@8.216.53.29 'bash /tmp/wechat-autofill-wechatid/scripts/apply-on-server.sh /opt/tennis-ai'
```

**Do not invent AppSecret.** Leave `WECHAT_MP_*` untouched.  
**Do not** mass-UPDATE/overwrite users' custom `wechatId` rows in Postgres.

## Test

```bash
python3 -m unittest tests.test_wechat_autofill_wechatid -v
```

## Four-surface

- Web：kit apply + Next build（约球 WebView 同源 → APK/IPA）
- 小程序：`session.js` 仍缓存服务端返回的 `wechatId`（现多为空，等用户填写）。本机：`~/Downloads/mp-weixin (2)`（Mac sync）
- 网页/APK 登录页仍无微信入口

## Local MP sync (Mac)

Copy from repo:

- `miniprogram/utils/session.js`
- `miniprogram/pages/login/login.wxml` / `login.js`（显示名文案）
- Keep `project.config.json` appid `wx09896b686bc2f565`
