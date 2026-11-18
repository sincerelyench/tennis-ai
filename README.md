# 网球挥拍测评 2.0

上传训练录像，生成评分和练习建议。

## 线上

- HTTPS（Caddy + sslip.io，与 knx 同模式）：https://tennis.47.93.203.28.sslip.io/
- IP 入口（nginx）：http://47.93.203.28/tennis-ai/

服务器目录 `/opt/tennis-ai`。更新：在机器上执行 `deploy/pull.sh`（不覆盖 `.env`、样例视频、模型权重）。

## 本地运行

```bash
cp .env.example .env
# 填入点评服务与对象存储配置
./run_web.sh
# 打开 http://127.0.0.1:27116
```

把侧面样例视频放到 `samples/demo.mp4` 后，可点「分析 1 分钟样例」（只分析前 60 秒）。自己上传的视频按整段分析。能看到球或球拍时，击球画面会按球和拍的距离选取。

## 小程序、Android 与 iOS 本地运行

网页入口是 `http://127.0.0.1:27116/e1`。小程序、Android 和 iOS 都调用现有的 `POST /api/analyze` 与 `GET /api/jobs/{id}`。分析仍由原来的 pipeline 完成。任务完成后，同一页面打开四维结果：`GET /api/jobs/{id}/result`。iOS 壳的 User-Agent 带 `ZhangqiuIOS`，上传时 `client` 为 `ios`。

产品小程序（涨球乐）走 **web-view 对齐现网**：`miniprogram/` 仅保留微信登录壳，登录后打开 `https://yqchen.blog/tennis`（与 APK/IPA 同源）。正式登录：`wx.login` → `POST /api/auth/wechat` → `GET /api/auth/mp-enter?token=…`。网页与安卓 APK **不要**微信登录入口。本仓库 Python `/e1` 仍可用 `POST /api/auth/mock` 做分析联调（`DEV_AUTH_SECRET`）。

文案在 `i18n/zh-CN.json` 和 `i18n/en.json`。默认中文。Android 和 iOS WebView 打开线上 `/tennis`；地址加 `?lang=en` 会直接用英文。

### 微信开发者工具（涨球乐 · 对齐网页）

1. 开发者工具 → 导入项目 → 选仓库 `miniprogram/`（或解压后的 `mp-weixin.zip` 根目录）。
2. AppID：测试号或 `touristappid`；正式 AppID 须与生产 `WECHAT_MP_APPID` 一致（改 `miniprogram/project.config.json`）。
3. 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
4. `miniprogram/config.js` 的 `apiBase` 默认为 `https://yqchen.blog/tennis`。
5. 正式发布前：公众平台业务域名添加 `https://yqchen.blog`。
6. 路径：微信登录 → web-view 进入约球 · 排行榜 · 教练 · 我的。说明见 `deploy/mp-weixin-sync/mp-weixin-README.txt`。

### Android

Android 工程是一层 WebView，打开 `/e1`，不另写分析或打分界面。应用名是「涨球」。

默认打包地址是线上 `https://tennis.47.93.203.28.sslip.io/e1`。要改地址，打包时传入 `ZQ_START_URL`：

```bash
cd android
./gradlew assembleDebug
# 模拟器连本机后端：
./gradlew assembleDebug -PZQ_START_URL=http://10.0.2.2:27116/e1
```

模拟器访问电脑的 `127.0.0.1` 用 `10.0.2.2`。真机连开发机时，把后端监听改成 `0.0.0.0`，并把 `ZQ_START_URL` 设成电脑的局域网地址。也可以不重新打包，用 adb 临时指定：

```bash
adb shell am start -n app.zhangqiu/.MainActivity --es start_url "http://192.168.1.10:27116/e1"
```

网络或证书失败时，WebView 显示中英对照的说明和重试，而不是空白页。开发包仍允许 HTTP 明文，方便连本机；默认的线上地址是 HTTPS。

页面路径与网页相同：登录 → 拍摄引导 → 上传 → 排队页看到任务编号，分析结束后打开四维结果。语言切换在页面右上角。线上 `/e1` 要等本分支合入 `main` 后，在服务器执行 `deploy/pull.sh` 才会出现。

### iOS

iOS 工程是一层 WKWebView，打开 `/e1`，不另写分析或打分界面。应用名是「涨球」，Bundle ID 是 `app.zhangqiu`。需要 Mac 上的 Xcode 15 或更新版本，部署目标是 iOS 15。

用 Xcode 打开并在模拟器里运行：

```bash
open ios/Zhangqiu.xcodeproj
```

选 scheme `Zhangqiu`、一台 iPhone 模拟器，按 Run。模拟器不需要付费开发者账号；如果 Xcode 提示签名，在 Signing & Capabilities 里把 Team 选成 Personal Team。命令行可以先列出模拟器名字，再编译：

```bash
xcrun simctl list devices available
xcodebuild -project ios/Zhangqiu.xcodeproj -scheme Zhangqiu -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO build
```

模拟器名字以本机 `simctl list` 为准。模拟器访问 Mac 本机后端用 `127.0.0.1`，不是 Android 模拟器的 `10.0.2.2`。

默认地址是线上 `https://tennis.47.93.203.28.sslip.io/e1`，写在构建项 `ZQ_START_URL` 里，打进 `Info.plist` 的 `ZQStartURL`。要改地址再编译：

```bash
xcodebuild -project ios/Zhangqiu.xcodeproj -scheme Zhangqiu -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO \
  ZQ_START_URL='http://127.0.0.1:27116/e1' build
```

不想重新编译时，用启动环境变量覆盖（优先于打进包里的地址）。Xcode 里：Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables，加上 `ZQ_START_URL` = `http://127.0.0.1:27116/e1`。也可以在 Arguments Passed On Launch 里写 `-ZQStartURL` 和下一行的地址。非法地址会被忽略，退回包内地址，再退回线上默认地址。

网络或证书失败、主框架 HTTP 状态大于等于 400 时，显示和 Android 相同的中英说明和「重试 / Retry」，而不是空白页。工程允许 HTTP 明文，方便连本机；默认的线上地址是 HTTPS。

选择视频和拍摄走 WKWebView 自带的文件面板（和 Safari 的 `<input type="file">` 一样，`capture="environment"` 会进相机）。Info.plist 里写了相机、麦克风、相册和本地网络的用途说明，否则系统会直接拒绝。页面上的按钮点的是隐藏 file input，壳在文档开头注入了一小段样式，避免 iOS 因为 `clip` 打不开选择器。User-Agent 带 `ZhangqiuIOS/1`，上传时 `client` 为 `ios`。

页面路径与网页相同：登录 → 拍摄引导 → 上传 → 排队页看到任务编号，分析结束后打开四维结果。语言切换在页面右上角。

真机侧载需要本机签名。在 Xcode 的 Signing & Capabilities 里选好 Team 后归档并导出 development IPA：

```bash
cd ios
xcodebuild -project Zhangqiu.xcodeproj -scheme Zhangqiu -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Zhangqiu.xcarchive archive
xcodebuild -exportArchive \
  -archivePath build/Zhangqiu.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist ExportOptions.development.plist
```

导出的包在 `ios/build/ipa/Zhangqiu.ipa`。用 Xcode Devices、Apple Configurator，或 `xcrun devicectl device install app --device <UDID> ios/build/ipa/Zhangqiu.ipa` 装到已注册的开发设备上。

上传成功后，任务的 `metadata.guide_completed` 与 `metadata.guide_checks` 会记在 job 上。三条都勾选才是引导完成；没勾完也能上传，标记为未完成。分析结束后，排队页可以打开四维结果。引导没完成时，结果页会提示机位可能影响分数。

同一登录用户、同一动作（正手 / 反手 / 发球）的成功分析会写进 `outputs/progress/<user_id>.json`，字段包括 user_id、stroke、job_id、四维分数、关键帧缩略图或击球时间、created_at。满 2 次才打开前后对比；只有 1 次时对比卡片是灰的。这个目录在 `.gitignore` 里，`deploy/pull.sh` 只拉代码并重启，不会清掉它。

Android 和 iOS 都不用新页面，WebView 打开的 `/e1` 就是这套结果。小程序在排队页进入 `pages/result/result`，请求同一个结果接口。

2.0 评分四维：重心（稳且低）、击球点（胸口高度、持拍侧稍外、身前约 45°）、动力链（伤病相关核心）、击球效果（拍头速度与旋转轨迹）。击球画面会标出实际击球点（球碰到拍的位置）和理想区。

## 环境变量

点评服务：

- `CURSOR_API_KEY`
- `CURSOR_SANDBOX_REPO_URL`
- `CURSOR_MODEL_ID`（默认 `grok-4.6`）
- `CURSOR_MODEL_EFFORT`（默认 `high`；点评任务不需要 xhigh）
- `CURSOR_REUSE_AGENT`（默认 `1`，复用已启动的点评会话）
- `CURSOR_AGENT_TIMEOUT_MS`（默认 `180000`）

对象存储（与 english-test 相同 bucket / prefix）：

- `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`
- `OSS_BUCKET`（默认 `nba-dev-sh`）
- `OSS_PREFIX`（默认 `wenbo`，对象在 `{prefix}/tennis-ai/{job_id}/`）
- `OSS_REGION` / `OSS_ENDPOINT`
- `OSS_URL_MODE=signed`
- `OSS_SIGNED_URL_SECONDS`（默认 7 天）

未配置或调用失败时任务会直接报错，不会改用本地文案或本地文件地址。
