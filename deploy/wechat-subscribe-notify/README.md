# ZQ-150 · 微信订阅消息（五类事件）

站内 notices **保留**；本 kit 为小程序用户（有 openid）增加微信订阅消息推送。

## 内容

| 路径 | 作用 |
|------|------|
| `opt-patch/lib/wechat-subscribe.ts` | access_token + subscribeMessage.send |
| `opt-patch/lib/wechat-subscribe-store.ts` | 记录 accept / 剩余发送次数 |
| `opt-patch/lib/mp-subscribe-client.ts` | H5 → 原生订阅页 bridge |
| `opt-patch/lib/match-intros.ts` | 邀请 / 应战 / 约球留言 hooks |
| `opt-patch/lib/match-scores.ts` | 待确认比分 / 确认后排行 hooks |
| `opt-patch/lib/network-coach-messages.ts` | 教练↔学员留言服务端持久化 + message 推送 |
| `opt-patch/lib/network-coach-board.ts` | 客户端板：local mirror + POST 服务端 |
| `opt-patch/app/api/coach/messages/` | GET/POST 教练留言 API |
| `opt-patch/components/notices-view.tsx` | 「开启微信通知」CTA |
| `opt-patch/app/api/auth/wechat-subscribe/` | GET 模板 / POST 上报 accept |
| `scripts/inject-friends-subscribe.py` | friends-view 订阅调用注入 |
| `scripts/inject-coach-board-hydrate.py` | coach-view 从服务端 hydrate |
| `scripts/apply-on-server.sh` | 生产 apply（Mac 另安排） |
| **`WECHAT-CONSOLE-TEMPLATES.md`** | **燕青模板字段清单（约球邀请已接线）** |
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

## 模板

燕青面向说明：**[`WECHAT-CONSOLE-TEMPLATES.md`](./WECHAT-CONSOLE-TEMPLATES.md)**

- ✅ `WECHAT_MP_TMPL_INVITE` = `y3dQG1ss-l3h_Ebe2fhWymaigXuuDYgvL_rvgeT7lg`（thing1/thing2/thing13）
- ⏳ 其余 4 个模板 ID 待燕青

未配置的事件：发送 skip；站内通知不受影响。Mac 生产 apply 另有安排。

## 与 ZQ-149

本包小程序壳基于 WebView + `/api/auth/wechat`；用户账号已是 `wx_<openid>`。本任务只加订阅消息，不改登录。
