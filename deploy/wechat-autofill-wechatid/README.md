# ZQ-153 · 微信登录写入微信号 + 显示名默认微信名

Builds on ZQ-149/151 (`wechatId` autofill). Same kit path; prod already has wechatId fill — re-apply after this change for **显示名** placeholder policy.

## Behavior (`POST /api/auth/wechat`)

| Field | When empty / placeholder | When user already set a real value |
| --- | --- | --- |
| **微信号** `wechatId` | openid 派生句柄（同 ZQ-151） | **不改** |
| **显示名** `displayName` | 默认用登录 body 的微信名 `nickName` | **不改** |

### 微信号写入值（官方拿不到真实微信号）

| 条件 | 写入值 |
| --- | --- |
| `wechatId` 已有 | 不变 |
| openid 符合 `^[A-Za-z0-9_-]{3,32}$` | **openid 原文** |
| openid 字符不合规 | `w` + `sha256("wxid:"+openid)[:31]` |

### 显示名

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

## Test

```bash
python3 -m unittest tests.test_wechat_autofill_wechatid -v
```

## Four-surface

- Web：kit apply + Next build
- APK / IPA：WebView 同源
- 小程序：登录页 `type="nickname"` 带入微信名；`session.js` 缓存 `wechatId` + `displayName`。本机路径：`~/Downloads/mp-weixin (2)`（Mac sync）

## Local MP sync (Mac)

Copy from repo (or kit mp-patch note):

- `miniprogram/utils/session.js`
- `miniprogram/pages/login/login.wxml` / `login.js`（显示名文案）
- Keep `project.config.json` appid `wx09896b686bc2f565`
