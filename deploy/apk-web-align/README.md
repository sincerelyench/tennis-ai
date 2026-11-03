# apk-web-align — APK ≡ live web

## Root cause
Parallel ships raced. Live `tennis-ai.apk` ended as **1.0.97** (match-wechat / tabs) with
`start_url=https://tennis.47.93.203.28.sslip.io/e1` (legacy E1 upload shell), while
**1.0.98** (video-clip) correctly pointed at `https://yqchen.blog/tennis` and was overwritten.

Web `/opt/tennis-ai` already has the cumulative product (约球 tab order, profile stats gone,
match WeChat intro, trim default/min 10s). APK was behind because the shell opened the wrong host.

## Fix
- `ZQ_START_URL` / default `start_url` → `https://yqchen.blog/tennis`
- iOS `ShellConfig.defaultStartURL` same
- APK **1.0.99 / 199** full `assembleRelease` + ZHANGQIU (no zip-inject)
- Carry forward uni-app injects (tabs / matchmaking WeChat / remove profile stats / …) for embedded www
