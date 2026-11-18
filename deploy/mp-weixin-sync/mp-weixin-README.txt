涨球乐 · 微信小程序（web-view 对齐网页）
====================================
构建日期：2026-11-18（ZQ-149）

产物
----
- mp-weixin.zip：微信小程序工程（原生登录壳 + web-view）
- AppID：touristappid（开发者工具/测试；正式 AppID 须与服务端 WECHAT_MP_APPID 一致）
- 公网：https://yqchen.blog/mp-weixin.zip

打开方式
--------
1. 下载并解压 mp-weixin.zip
2. 微信开发者工具 → 导入项目 → 选解压根目录（含 app.json）
3. AppID：测试号或 touristappid；正式发布换正式 AppID
4. 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
5. 正式发布前：公众平台 → 开发管理 → 业务域名 添加 https://yqchen.blog
6. 编译 → 预览：微信登录后 web-view 打开 https://yqchen.blog/tennis

登录
----
wx.login → POST https://yqchen.blog/tennis/api/auth/wechat
拿到 token 后 web-view 打开 /api/auth/mp-enter?token=… 写入 tennis_session cookie，再进首页。
未配置密钥或测试码无效时走 wechat-mock，仍可联调。
真机正式会话需要 systemd WECHAT_MP_APPID + WECHAT_MP_SECRET 与小程序 AppID 配对。

功能 / UI
--------
与 APK/IPA 相同：直接渲染网页 https://yqchen.blog/tennis
底栏：约球 · 排行榜 · 教练 · 我的（分析暂时隐藏）。
网页与安卓 APK 登录页不展示微信登录入口。

微信系统通知（订阅消息）
------------------------
现网约球提醒走站内通知（铃铛 / notices）。若要小程序外微信推送，需另加订阅消息模板与服务端发送；本包不含。
