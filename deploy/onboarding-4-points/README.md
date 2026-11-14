# ZQ-137：新用户介绍改成四个卖点

注册 / 首次打开引导弹窗：产品名 **涨球**，四条编号卖点（燕青产品口径）。

## 中文文案（定稿）

- **标题**：欢迎来到涨球
- **导语**：多打球、约对手、看排名、找教练——让我们大家一起涨球。
1. **一起涨球** — 多打球、多比赛，在实战中打磨技术，大家一起涨球。
2. **约到水平相当的球友** — 轻松找到本地水平相当（或上下）的球友来挑战。
3. **赛后看排名变化** — 排名不随意，按与对手水平相近程度计算，打完就能看到升降。
4. **AI 教练与真实网络教练** — 日常训练有疑问或拍下动作，可获 AI 教练与真实网络教练指导。

## Apply

```bash
bash deploy/onboarding-4-points/scripts/apply-on-server.sh /opt/tennis-ai
```

Code-only（`lib/i18n/messages.ts` + legacy `lib/messages.ts`）。无数据库写入。

## Four-surface

| Surface | Action |
| --- | --- |
| Web `/tennis` | Deploy required（本 kit） |
| Android APK | WebView → live `/tennis`（无需重打壳） |
| iOS IPA | WebView → live `/tennis`（无需重打壳） |
| mp-weixin | 拍摄引导页独立；产品介绍弹窗走 WebView / 网页端；写 NOTE |

Preview: https://yqchen.blog/onboarding-4-points.html
