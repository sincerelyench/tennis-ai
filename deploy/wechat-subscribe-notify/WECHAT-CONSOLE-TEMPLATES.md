# 微信公众平台 · 订阅消息模板（ZQ-150）

燕青在 [微信公众平台](https://mp.weixin.qq.com) → **功能** → **订阅消息** → **公共模板库** 选用（或申请）下列五类，把模板 ID 配到服务器环境变量。  
**不要 invent AppSecret。** 模板 ID 由燕青从公众平台复制；未配置的事件发送路径会 skip，站内通知仍可用。

> 本文件路径（PR / 仓库）：`deploy/wechat-subscribe-notify/WECHAT-CONSOLE-TEMPLATES.md`

## 环境变量

| 事件 | Env | 说明 | 状态 |
|------|-----|------|------|
| 排行榜分数/名次变动 | `WECHAT_MP_TMPL_LADDER` | confirmScore 后通知双方 | ⏳ 待燕青 |
| 收到约战/挑战邀请 | `WECHAT_MP_TMPL_INVITE` | createMatchIntro → 对方 | ✅ 已提供 |
| 发出的邀请被接受 | `WECHAT_MP_TMPL_INVITE_ACCEPTED` | acceptIntro → 发起方 | ⏳ 待燕青 |
| 比分结果与综述确认 | `WECHAT_MP_TMPL_SCORE_CONFIRM` | createPendingScore → 对手 | ⏳ 待燕青 |
| 站内留言（约球 + **教练**） | `WECHAT_MP_TMPL_MESSAGE` | `postMessageToIntro` + `POST /api/coach/messages` | ⏳ 待燕青 |

已有：`WECHAT_MP_APPID` / `WECHAT_MP_SECRET`（登录用，发送 access_token 复用）。

可选：`WECHAT_MP_STATE=formal|trial|developer`（默认 formal）。

systemd 示例见 `wechat-subscribe-tmpl.env.example`。

---

## 已确认模板（燕青提供）

### 2. 收到约战/挑战邀请 — `WECHAT_MP_TMPL_INVITE`

| 项 | 值 |
|----|-----|
| 模板 ID | `y3dQG1ss-l3h_Ebe2fhWymaigXuuDYgvL_rvgeT7lg` |
| 标题 | 用户邀约通知 |
| 场景 | 约球通知 |

**字段映射（服务端 `buildTemplateData("invite")` 已按此接线）：**

| 字段 | 含义 | 代码填入 |
|------|------|----------|
| `thing1` | 邀约标题 | 「约球邀请」或「挑战邀请」 |
| `thing2` | 邀约内容 | 如「张三邀你约球，请打开涨球查看」 |
| `thing13` | 邀请人 | 发起方显示名 |

配置：

```ini
Environment=WECHAT_MP_TMPL_INVITE=y3dQG1ss-l3h_Ebe2fhWymaigXuuDYgvL_rvgeT7lg
```

---

## 仍待创建（推荐选词）

实际字段名以公众平台「我的模板」详情为准；提供后改 `lib/wechat-subscribe.ts` 的 `buildTemplateData` 即可。

### 1. 排行榜分数和位置变动 — `WECHAT_MP_TMPL_LADDER`

- 搜索：`积分变动` / `等级变更` / `排名提醒`
- 当前代码字段：`thing1` 变更说明 · `thing2` 详情 · `time3` 时间

### 3. 发出的邀请被接受 — `WECHAT_MP_TMPL_INVITE_ACCEPTED`

- 搜索：`报名结果` / `邀请结果` / `审核通知`
- 当前代码字段：`name1` 应战方 · `phrase2` 状态 · `time3` 时间

### 4. 录入比分结果和综述的确认邀请 — `WECHAT_MP_TMPL_SCORE_CONFIRM`

- 搜索：`结果确认` / `待办提醒` / `审核提醒`
- 当前代码字段：`name1` 提交人 · `thing2` 比分 · `thing3` 综述 · `time4` 时间

### 5. 所有站内留言 — `WECHAT_MP_TMPL_MESSAGE`

- 搜索：`留言提醒` / `新消息提醒` / `评论通知`
- 当前代码字段：`name1` 发送人 · `thing2` 留言摘要 · `time3` 时间
- 覆盖：**约球互留** + **网络教练↔学员留言**（`POST /api/coach/messages`）

## 客户端

- 登录后进入原生页 `pages/subscribe`，用户点击「开启订阅」→ `wx.requestSubscribeMessage`
- H5（web-view）经 `wx.miniProgram.navigateTo` 打开同一页；通知中心有「开启微信通知」
- 一次性订阅：每 accept 一次可发一条；服务端记剩余额度（微信侧仍是最终校验）

## 说明

- 未做过小程序微信登录、无 `openid` 的账号：发送 skip（网页/APK 用户无微信推送，符合产品约束）。
- 与「赛后交换微信号」无关。
- Mac 生产 apply 另有安排；本 kit 不在本机 SSH 上线。
