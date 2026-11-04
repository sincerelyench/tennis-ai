涨球 · 微信小程序（仅约球 + 微信登录）
====================================
构建日期：2026-11-04

产物
----
- mp-weixin.zip：原生微信小程序工程
- AppID：touristappid（测试/游客；正式 AppID 与 WECHAT_MP_APPID/SECRET 对齐）
- 公网：https://yqchen.blog/mp-weixin.zip

打开方式
--------
1. 下载并解压 mp-weixin.zip
2. 微信开发者工具 → 导入项目 → 选解压根目录（含 app.json）
3. AppID：测试号或 touristappid
4. 详情 → 本地设置 → 勾选「不校验合法域名…」
5. 编译 → 预览：首页为微信登录，登录后进约球（无分析/教练/我的）

登录
----
wx.login → POST https://yqchen.blog/tennis/api/auth/wechat
可选 nickName；服务端 jscode2session（需 WECHAT_MP_APPID + WECHAT_MP_SECRET）
未配置密钥或测试码无效时走 wechat-mock，仍可联调约球。

范围
----
小程序仅约球。网页 / APK / IPA 仍为完整产品。
