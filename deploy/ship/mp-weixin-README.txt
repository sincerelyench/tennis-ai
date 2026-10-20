涨球 · 微信小程序（mp-weixin）使用说明
================================
构建日期：2026-10-20（含掌球教练动作库）

产物
----
- mp-weixin.zip：原生微信小程序工程（解压后为 mp-weixin/ 目录）
- AppID：touristappid（测试 / 游客；正式 AppID 请在微信公众平台申请后替换）
- 公网下载：https://yqchen.blog/mp-weixin.zip

在微信开发者工具里打开
----------------------
1. 解压 mp-weixin.zip，得到 mp-weixin/（内含 app.js / app.json / project.config.json / pages/ …）。
2. 打开「微信开发者工具」→ 导入项目 → 目录选该 mp-weixin 根目录。
3. AppID：选「测试号」或保持 project.config.json 里的 touristappid。
4. 详情 → 本地设置 → 勾选：
   - 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
5. 编译后应看到品牌「涨球」、中英切换、手机号 + 验证码登录（验证码显示在页内，不发短信）。
6. 登录后：拍摄引导 → 只选技术（正手 / 反手 / 发球，无水平下拉）→ 上传视频。
7. 首页另有「动作库 / 我的示范」：按技术写入讲解文案与示范视频；教练显示名「掌球教练」/ Zhangqiu Coach。

apiBase
-------
config.js 默认：
  apiBase: "https://yqchen.blog/tennis"

与网页同一套登录与分析接口。若联调本机 GPU 算法仓，可临时改成
  http://127.0.0.1:27116

换成正式 AppID
--------------
1. 改 project.config.json 的 "appid"。
2. 微信公众平台 → 开发 → 开发管理 → 服务器域名：
   request合法域名、uploadFile合法域名 均加 https://yqchen.blog
3. 重新上传 / 提交审核。

功能约定
--------
- 品牌：涨球
- 教练显示名：掌球教练 / Zhangqiu Coach（无 Poppy / 东东）
- 开局只选技术动作，无 NTRP / 水平下拉
- 动作库：按击球项维护讲解 + 示范视频
- 中英 i18n（右上角切换）
