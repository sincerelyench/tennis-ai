# ZQ-159：登录页恢复网页版介绍弹窗

产品名 **涨球乐**。介绍文案恢复为网页四卖点（约球 / 多打球），**不是**「动作」版。

## 中文文案

- **标题**：欢迎来到涨球乐
- **导语**：多打球、约对手、看排名、找教练——让我们大家一起涨球乐。
1. **一起涨球** — 多打球、多比赛，在实战中打磨技术，大家一起涨球乐。
2. **约到水平相当的球友** — 轻松找到本地水平相当（或上下）的球友来挑战。
3. **赛后看排名变化** — 排名不随意，按与对手水平相近程度计算，打完就能看到升降。
4. **AI 教练与真实网络教练** — 日常训练有疑问或拍下动作，可获 AI 教练与真实网络教练指导。

## 时机

- **网页 / APK / IPA**：`LoginView` 挂载 `<Onboarding />`，打开登录页即可看到（清 `tennis-onboarded`）。
- **微信小程序**：原生登录页弹同一套四点介绍；关掉后带 `zq_onboarded=1` 进 web-view，避免登录后再弹一次。

## Apply（Mac Keychain）

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e scp -r deploy/login-intro-restore root@8.216.53.29:/tmp/login-intro-restore
sshpass -e ssh root@8.216.53.29 'bash /tmp/login-intro-restore/scripts/apply-on-server.sh /opt/tennis-ai'
```

## 本地小程序

同步 `miniprogram/pages/login/*` + `pages/web/web.js` → `~/Downloads/mp-weixin (2)/`。

## 相关

- ZQ-158：微信登录 Tab 一键登录、不填显示名（同 PR）
- 叠在 #151 / #152 / #148 登录栈之上
