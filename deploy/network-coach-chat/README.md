# 涨球 · 涨球教练 + 网络教练问答

Coach tab shows **涨球教练** plus the player's **selected network coach**. Both can Q&A / chat. **选教练** flow kept. Brand never Poppy / 东东 / 掌球教练.

## Surfaces

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` CoachView + `/api/coach/chat` persona resolve |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.92** (no zip-inject) |
| iOS IPA | same www inject embedded in shell |
| 微信小程序 | `miniprogram/pages/coach` + `coach-picker` |

## APIs

- `POST /tennis/api/coach/chat` — body includes `coachId`; network coaches use published profile + library prompts
- `GET/PUT /tennis/api/player/coach` — selected network coach (unchanged)
- `GET /tennis/api/coaches?published=1` — picker list

## Seed

`scripts/seed-network-coach.py` publishes **林凯教练** (`lin_kai`) so the tab can show two distinct personas.

## Deploy

```bash
bash deploy/network-coach-chat/scripts/mac-four-surface-release.sh
# or server only:
# scp -r deploy/network-coach-chat root@8.216.53.29:/tmp/
# ssh ... 'bash /tmp/network-coach-chat/scripts/apply-on-server.sh /opt/tennis-ai'
```

APK: **1.0.92** / versionCode **192**, Gradle `assembleRelease` + ZHANGQIU signing.

## Preview

Open `preview/index.html` or https://yqchen.blog/tennis/network-coach-chat.html after apply.

## Evidence

`media/network-coach-chat-20261102/`
