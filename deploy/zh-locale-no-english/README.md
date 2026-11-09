# zh locale：去掉残留英文

当 `tennis-locale=zh`（或浏览器语言为中文）时，全站 UI 文案只出中文：

- 恢复被近期部署覆盖的 `journey.*` / `friends.tab*` / `profile.matchHistory*` 等 i18n key
- 中文 messages 去掉 UTR/NTRP/MP4/YouTube 等中英混排（产品标签「AI 教练」保留）
- 页面 `<title>` 随 cookie 切中英文（登录 / 约球 / 教练 / 我的 / 通知 / 旅程等）
- 约球 inject 脚本中文分支同步为「等级分」

## 部署

```bash
bash deploy/zh-locale-no-english/scripts/apply-on-server.sh /opt/tennis-ai
```

## 验证

浏览器设 `localStorage.tennis-locale=zh` 与 cookie `tennis-locale=zh`，检查教练、约球、我的、登录、通知、成长旅程无英文残留。
