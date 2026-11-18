# ZQ-150 · 微信订阅消息（五类事件）

站内 notices **保留**；本 kit 为小程序用户（有 openid）增加微信订阅消息推送。

## 内容

| 路径 | 作用 |
|------|------|
| `opt-patch/lib/wechat-subscribe.ts` | access_token + subscribeMessage.send |
| `opt-patch/lib/wechat-subscribe-store.ts` | 记录 accept / 剩余发送次数 |
| `opt-patch/lib/mp-subscribe-client.ts` | H5 → 原生订阅页 bridge |
| `opt-patch/lib/match-intros.ts` | 邀请 / 应战 / 留言 hooks |
| `opt-patch/lib/match-scores.ts` | 待确认比分 / 确认后排行 hooks |
| `opt-patch/components/notices-view.tsx` | 「开启微信通知」CTA |
| `opt-patch/app/api/auth/wechat-subscribe/` | GET 模板 / POST 上报 accept |
| `scripts/inject-friends-subscribe.py` | 不覆盖整份 friends-view，只注入订阅调用 |
| `scripts/apply-on-server.sh` | 生产 apply |
| `WECHAT-CONSOLE-TEMPLATES.md` | 燕青创建模板说明 |
| `miniprogram/`（仓库根） | login → subscribe 页 + `requestSubscribeMessage` |

## 生产 apply（Mac Keychain）

云 VM 通常无 SSH 密钥。在 **Mac** 上：

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e scp -o StrictHostKeyChecking=accept-new -r \
  deploy/wechat-subscribe-notify root@8.216.53.29:/tmp/wechat-subscribe-notify
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@8.216.53.29 \
  'bash /tmp/wechat-subscribe-notify/scripts/apply-on-server.sh /opt/tennis-ai'
```

或：`bash deploy/wechat-subscribe-notify/scripts/mac-apply.sh`

小程序 zip 上传：`bash deploy/wechat-subscribe-notify/scripts/upload-mp-zip.sh`

## Blocker

在公众平台创建 5 个订阅消息模板，并把 ID 写入 systemd drop-in（见 `wechat-subscribe-tmpl.env.example`）。  
未配置时：代码已上线但微信推送 skip；站内通知不受影响。

## 与 ZQ-149

本包小程序壳基于 WebView + `/api/auth/wechat`；用户账号已是 `wx_<openid>`。本任务只加订阅消息，不改登录。
