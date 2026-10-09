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

## 小程序与 Android 本地运行（E1）

E1 是拍摄引导、上传和排队，不是四维结果页。网页入口是 `http://127.0.0.1:27116/e1`，小程序和 Android 都调用现有的 `POST /api/analyze` 与 `GET /api/jobs/{id}`。分析仍由原来的 pipeline 完成。

登录是开发态模拟：客户端把一段 code 交给 `POST /api/auth/mock`，换回 token。正式微信登录还没接。可选环境变量 `DEV_AUTH_SECRET` 用来签发这个开发 token。

文案在 `i18n/zh-CN.json` 和 `i18n/en.json`。默认中文。网页和小程序右上角可以切到 EN。小程序里的 `miniprogram/i18n/*.js` 与这两份 JSON 内容相同。Android 打开的就是这个网页，地址加 `?lang=en` 会直接用英文。

### 微信开发者工具

1. 按上面的方式启动后端，确认 `http://127.0.0.1:27116/api/health` 能打开。
2. 开发者工具选择「导入项目」，目录选仓库里的 `miniprogram/`。
3. AppID 使用测试号，或保持工程里的占位 `touristappid`。正式 AppID 以后再换，改 `miniprogram/project.config.json` 的 `appid`。
4. 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。工程里 `urlCheck` 已是 `false`，仍建议在工具里再勾一次。
5. 后端不在本机 `127.0.0.1:27116` 时，改 `miniprogram/config.js` 的 `apiBase`。
6. 建议路径：首页看到「涨球」→ 开发态登录 → 拍摄引导里勾选侧面机位、全身入镜、球拍可见（可以不勾完）→ 选择或拍摄视频 → 上传 → 排队页出现任务编号。右上角可切换中文 / EN。
7. 失败时应看到中文或英文说明，例如未登录、登录失效、视频超过 400MB、网络不通。不要把没有 `job_id` 的响应当成上传成功。

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

页面路径与网页相同：登录 → 拍摄引导 → 上传 → 排队页看到任务编号。语言切换在页面右上角。线上 `/e1` 要等本分支合入 `main` 后，在服务器执行 `deploy/pull.sh` 才会出现。

上传成功后，任务的 `metadata.guide_completed` 与 `metadata.guide_checks` 会记在 job 上。三条都勾选才是引导完成；没勾完也能上传，标记为未完成。排队页只显示任务编号和状态，不展示四维分数。

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
