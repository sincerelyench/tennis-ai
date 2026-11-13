# 个人资料可编辑微信号 + 安卓去掉微信登录

## Product
- **ZQ-128**：「我的 / 个人资料」展示并允许自行修改 **微信号** → `wechatId`（`GET/PATCH /api/auth/profile`）。中文 UI。
- **ZQ-129**：Android APK 登录页去掉「微信登录」入口（`ZhangqiuAndroid` UA）；网页本就无入口；小程序保留微信登录。

## Files
- `opt-patch/components/profile-view.tsx` — 头部展示 + 编辑/保存微信号
- `opt-patch/components/login-view.tsx` — `showWechatLogin = shell && !androidShell`
- 复用线上：`app/api/auth/profile/route.ts`、`lib/auth-store.ts`、`lib/session-role.ts`

## Apply (web)
```bash
bash scripts/apply-on-server.sh /opt/tennis-ai
```

## APK
完整 `assembleRelease` + ZHANGQIU 重签后上传 `/var/www/apk/tennis-ai.apk`（禁止 zip-inject）。见 `scripts/build-apk-release.sh`。

## Ops
- 不造测试用户；不改 陈燕青 wechat（并行任务）。
- 全量 `next build` 完成后再 restart；使用 deploy lock。
