# 涨球 · AI 涨球教练 + 真人网络教练留言

Coach tab shows **涨球教练** (AI instant Q&A) plus the player's **selected network coach** (real human messaging / 留言). They do **not** share the same instant-chat UI. **选教练** flow kept. Brand never Poppy / 东东 / 掌球教练.

## UX split

| Persona | Kind | UI |
| --- | --- | --- |
| 涨球教练 | AI | Instant chat / Q&A |
| 网络教练 | Human | Message board / 留言 (wait for reply) |

## Surfaces

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai` CoachView + personas |
| Android APK | `uniapp-www` inject + `assembleRelease` **1.0.93** (no zip-inject) |
| iOS IPA | same www inject embedded in shell |
| 微信小程序 | `miniprogram/pages/coach` + `coach-picker` |

## APIs

- `POST /tennis/api/coach/chat` — **AI 涨球教练 only**
- Network coach messages stored client-side (`tennis-network-coach-messages-v1`) pending human reply
- `GET/PUT /tennis/api/player/coach` — selected network coach
- `GET /tennis/api/coaches?published=1` — picker list

## Seed

`scripts/seed-network-coach.py` publishes **林凯教练** (`lin_kai`).

## Deploy

```bash
bash deploy/network-coach-chat/scripts/mac-four-surface-release.sh
```

APK: **1.0.93** / versionCode **193**, Gradle `assembleRelease` + ZHANGQIU signing.

## Preview

Open `preview/index.html` or https://yqchen.blog/tennis/network-coach-chat.html after apply.

## Evidence

`media/coach-ai-vs-human-20261102/`
