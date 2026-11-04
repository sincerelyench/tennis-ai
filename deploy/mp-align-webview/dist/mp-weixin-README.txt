涨球 · 微信小程序（web-view 对齐网页）
====================================
构建日期：2026-11-05

产物
----
- mp-weixin.zip：微信小程序工程（原生登录壳 + web-view）
- AppID：touristappid（测试/游客；正式 AppID 与 WECHAT_MP_APPID/SECRET 对齐）
- 公网：https://yqchen.blog/mp-weixin.zip

打开方式
--------
1. 下载并解压 mp-weixin.zip
2. 微信开发者工具 → 导入项目 → 选解压根目录（含 app.json）
3. AppID：测试号或 touristappid
4. 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
5. 正式发布前：公众平台 → 开发管理 → 业务域名 添加 https://yqchen.blog
6. 编译 → 预览：微信登录后 web-view 打开 https://yqchen.blog/tennis

登录
----
wx.login → POST https://yqchen.blog/tennis/api/auth/wechat
拿到 token 后 web-view 打开 /api/auth/mp-enter?token=… 写入 tennis_session cookie，再进首页。
未配置密钥或测试码无效时走 wechat-mock，仍可联调。

功能 / UI
--------
与 APK/IPA 相同：直接渲染网页 https://yqchen.blog/tennis
（分析 / 约球 / 教练 / 我的 四 tab 由网页自己提供，避免原生再漂移）。

涨球 mp-align-webview 2026-11-05：web-view 包裹 tennis，微信登录桥接会话。
