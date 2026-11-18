# ZQ-149 · 微信登录自动写入微信号

## Problem

微信登录后仍弹「完善资料」要求填写微信号；约球创建也校验 `wechatId`。小程序官方 API **无法**拿到真实微信号字符串；`nickName` 只宜作显示名。

## Fix

1. `loginWithWeChat`：若 `wechatId` 为空，写入 **openid 派生句柄**（见下方「写入值」）。
2. `wechatContactSatisfied`：有 `wechatId` **或** 已绑定 `openid` 即满足约球/完善资料微信门闩。
3. `getSession`：对已绑定 openid 的旧会话惰性回填 `wechatId`（「我的」栏可见，无需强制再登）。
4. `GET`/`POST` 约球侧 `getWechatIdForPhone`/`Player`：缺显式微信号时回退 openid 派生值。
5. `/api/auth/wechat` 响应带上 `wechatId` + `needsProfileSetup`。
6. 小程序 `session.saveAuth` 缓存服务端返回的 `wechatId`。

**不**覆盖用户已手动设置的 `wechatId`。**不**用 nickName 填微信号。**不**发明生产用户。

## 写入「微信号」的值

| 条件 | 写入值 |
| --- | --- |
| `wechatId` 已有 | 不变 |
| openid 已符合 `^[A-Za-z0-9_-]{3,32}$` | **openid 原文**（常见 28 位） |
| openid 过长/字符不合规 | `w` + `sha256("wxid:"+openid)` 的前 31 位十六进制 |

## Apply (prod)

Host: `root@8.216.53.29` `/opt/tennis-ai`

```bash
bash deploy/wechat-autofill-wechatid/scripts/apply-on-server.sh /opt/tennis-ai
```

Mac（Keychain，与 ZQ-147/148 相同）:

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e scp -r deploy/wechat-autofill-wechatid root@8.216.53.29:/tmp/wechat-autofill-wechatid
sshpass -e ssh root@8.216.53.29 'bash /tmp/wechat-autofill-wechatid/scripts/apply-on-server.sh /opt/tennis-ai'
```

## Test

```bash
python3 -m unittest tests.test_wechat_autofill_wechatid -v
```

## Four-surface

- Web：本 kit apply + Next build
- APK / IPA：WebView 同源，无需重签
- 小程序：同步仓库 `miniprogram/`（或燕青本机 `~/Downloads/mp-weixin (2)`）；业务门闩在服务端
