# 微信公众平台 · 订阅消息模板（ZQ-150）

燕青在 [微信公众平台](https://mp.weixin.qq.com) → **功能** → **订阅消息** → **公共模板库** 选用（或申请）下列五类，把模板 ID 配到服务器环境变量。  
**不要把 AppSecret / 模板 ID 写进聊天或 invent 假值。** 代码已用占位符；未配置时发送路径会 skip，站内通知仍可用。

## 环境变量

| 事件 | Env | 说明 |
|------|-----|------|
| 排行榜分数/名次变动 | `WECHAT_MP_TMPL_LADDER` | confirmScore 后通知双方 |
| 收到约战/挑战邀请 | `WECHAT_MP_TMPL_INVITE` | createMatchIntro → 对方 |
| 发出的邀请被接受 | `WECHAT_MP_TMPL_INVITE_ACCEPTED` | acceptIntro → 发起方 |
| 比分结果与综述确认 | `WECHAT_MP_TMPL_SCORE_CONFIRM` | createPendingScore → 对手 |
| 站内留言 | `WECHAT_MP_TMPL_MESSAGE` | postMessageToIntro → 对端 |

已有：`WECHAT_MP_APPID` / `WECHAT_MP_SECRET`（登录用，发送 access_token 复用）。

可选：`WECHAT_MP_STATE=formal|trial|developer`（默认 formal）。

systemd 示例见 `wechat-subscribe-tmpl.env.example`。

## 推荐选词（公共模板库搜索关键词）

实际字段名以公众平台「我的模板」详情为准；服务端 `buildTemplateData` 按下列 **推荐** 键组装。若选中的模板关键字序号不同，改 `lib/wechat-subscribe.ts` 的 `buildTemplateData` 即可。

### 1. 排行榜分数和位置变动 — `WECHAT_MP_TMPL_LADDER`

- 搜索：`积分变动` / `等级变更` / `排名提醒`
- 推荐字段：
  - `thing1` 变更说明（如「排行榜分数变动」）
  - `thing2` 详情（分数/名次摘要）
  - `time3` 时间

### 2. 收到约战/挑战邀请 — `WECHAT_MP_TMPL_INVITE`

- 搜索：`活动邀请` / `约球` / `比赛邀请`
- 推荐字段：
  - `name1` 邀请人
  - `thing2` 邀请类型（约战/挑战）
  - `time3` 时间

### 3. 发出的邀请被接受 — `WECHAT_MP_TMPL_INVITE_ACCEPTED`

- 搜索：`报名结果` / `邀请结果` / `审核通知`
- 推荐字段：
  - `name1` 应战方
  - `phrase2` 状态（如「已应战」）
  - `time3` 时间

### 4. 录入比分结果和综述的确认邀请 — `WECHAT_MP_TMPL_SCORE_CONFIRM`

- 搜索：`结果确认` / `待办提醒` / `审核提醒`
- 推荐字段：
  - `name1` 提交人
  - `thing2` 比分
  - `thing3` 综述/说明
  - `time4` 时间

### 5. 所有站内留言 — `WECHAT_MP_TMPL_MESSAGE`

- 搜索：`留言提醒` / `新消息提醒` / `评论通知`
- 推荐字段：
  - `name1` 发送人
  - `thing2` 留言摘要（≤20 字）
  - `time3` 时间

## 客户端

- 登录后进入原生页 `pages/subscribe`，用户点击「开启订阅」→ `wx.requestSubscribeMessage`
- H5（web-view）经 `wx.miniProgram.navigateTo` 打开同一页；通知中心有「开启微信通知」
- 一次性订阅：每 accept 一次可发一条；服务端在 `wechat_subscribe` blob 记剩余额度（微信侧仍是最终校验）

## 已知限制

- **网络教练留言** 现为浏览器 `localStorage`，无服务端钩子；约球站内留言已覆盖。教练服务端化后再挂同一 `message` 模板。
- 未做过小程序微信登录、无 `openid` 的账号：发送 skip（网页/APK 用户无微信推送，符合产品约束）。
- 与「赛后交换微信号」无关。
