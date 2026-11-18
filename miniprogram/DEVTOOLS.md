# 涨球乐 · 微信开发者工具工程

**本目录 `miniprogram/` 即本地微信小程序工程（主交付物）。**  
公网 `https://yqchen.blog/mp-weixin.zip` 仅为可选打包镜像，不是开发源。

## 路径

| 环境 | 路径 |
|---|---|
| Git 仓库（本工程） | `tennis-ai/miniprogram/` |
| 本 cloud checkout | `/agent/repos/tennis-ai/miniprogram/` |
| 燕青 Mac 历史副本（若开发者工具指向此处） | `/Users/yanqing/Downloads/tennis-ai/miniprogram/` |

微信开发者工具 → 导入项目 → 选择含 `app.json` 的 **`miniprogram/`** 目录。

## 登录选项

登录页默认 **微信登录**，另可选：

1. **微信登录** — `wx.login` → `POST /api/auth/wechat` → `web-view` `/api/auth/mp-enter`
2. **账号密码** — `POST /api/auth/login` `{ username, password }`
3. **手机验证码** — `POST /api/auth/code` → `POST /api/auth/login` `{ phone, code }`

登录成功后 `pages/web` 打开现网 `https://yqchen.blog/tennis`（约球 · 排行榜 · 教练 · 我的）。

## 本地设置

1. AppID：测试号或 `project.config.json` 中的 `touristappid`；正式 AppID 须与生产 `WECHAT_MP_APPID` 一致。
2. 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS…」。
3. `config.js` → `apiBase: "https://yqchen.blog/tennis"`。
4. 正式发布前：公众平台业务域名添加 `https://yqchen.blog`。
