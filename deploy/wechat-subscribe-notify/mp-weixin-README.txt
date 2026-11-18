涨球乐 · 微信小程序（ZQ-150 订阅消息）
====================================
构建日期：2026-11-18（ZQ-150）

主交付
----
微信开发者工具打开仓库目录：
  tennis-ai/miniprogram/
说明见 miniprogram/DEVTOOLS.md。

本 zip 为可选镜像（yqchen.blog/mp-weixin.zip）。

登录 + 订阅
----
微信登录 → 原生「订阅消息」页（用户点「开启订阅」）
  → wx.requestSubscribeMessage(tmplIds)
  → POST /api/auth/wechat-subscribe 记录 accept
  → web-view /api/auth/mp-enter

H5 内也可 wx.miniProgram.navigateTo(/pages/subscribe/…)
通知中心有「开启微信通知」。

模板占位
----
miniprogram/config.js → subscribeTemplates（REPLACE_TMPL_*）
生产优先读服务端 WECHAT_MP_TMPL_*（GET /api/auth/wechat-subscribe）

系统通知
----
需公众平台订阅消息模板 + 服务端发送；见
deploy/wechat-subscribe-notify/WECHAT-CONSOLE-TEMPLATES.md
