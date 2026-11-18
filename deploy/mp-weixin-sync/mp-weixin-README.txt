涨球乐 · 微信小程序（可选 zip 镜像）
====================================
构建日期：2026-11-18（ZQ-149 follow-up）

主交付
----
请用微信开发者工具直接打开仓库目录：
  tennis-ai/miniprogram/
说明见 miniprogram/DEVTOOLS.md。

本 zip 仅为可选镜像（yqchen.blog/mp-weixin.zip），不是开发源。

登录选项（工程内）
----
微信登录（默认）| 账号密码 | 手机验证码
微信：wx.login → POST /api/auth/wechat → web-view /api/auth/mp-enter
