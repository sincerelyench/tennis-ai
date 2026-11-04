涨球 · 微信小程序（四 tab 全功能 + 微信登录）
====================================
构建日期：2026-11-05

产物
----
- mp-weixin.zip：原生微信小程序工程（分析 / 约球 / 教练 / 我的）
- AppID：touristappid（测试/游客；正式 AppID 与 WECHAT_MP_APPID/SECRET 对齐）
- 公网：https://yqchen.blog/mp-weixin.zip

打开方式
--------
1. 下载并解压 mp-weixin.zip
2. 微信开发者工具 → 导入项目 → 选解压根目录（含 app.json）
3. AppID：测试号或 touristappid
4. 详情 → 本地设置 → 勾选「不校验合法域名…」
5. 编译 → 预览：微信登录后进入四 tab（分析/约球/教练/我的）

登录
----
wx.login → POST https://yqchen.blog/tennis/api/auth/wechat
可选 nickName；服务端 jscode2session（需 WECHAT_MP_APPID + WECHAT_MP_SECRET）
未配置密钥或测试码无效时走 wechat-mock，仍可联调。

功能
----
- 分析：历史报告 + 新的视频分析（引导 / 上传 / 排队 / 结果）
- 约球：匹配、同城列表、约球消息、录入比分
- 教练：涨球教练对话 + 动作库
- 我的：显示名、所在地、退出

UI
--
浅色背景 + teal（#0d9488）主色，对齐 https://yqchen.blog/tennis 网页结构。
