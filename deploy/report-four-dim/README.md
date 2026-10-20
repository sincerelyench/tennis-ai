# 涨球 · 报告四维评分 + 速度估计（四端）

Adds reference-aligned information architecture to the analysis **report**:

1. **四维评分** cards — 重心 / 击球点 / 动力链 / 击球效果  
2. **速度估计** cards — 拍头 / 手腕 / 转髋 / 来球 / 出球 (km/h) + disclaimer  
3. **Charts** — radar + horizontal bars  

Brand: **涨球** (teal/lime product language — not cream/olive copy). Coach: **涨球教练**. No NTRP picker. Problem + coach / star demos unchanged.

## Field map (TAI JSON → UI)

| UI label | Source field | Max / unit |
| --- | --- | --- |
| 重心 | `overall.scores["重心"]` | 25 |
| 击球点 | `overall.scores["击球点"]` | 20 |
| 动力链 | `overall.scores["动力链"]` | 30 |
| 击球效果 | `overall.scores["击球效果"]` | 25 |
| 拍头 | `overall.speeds.swing_kmh` (`swing_from`) | km/h |
| 手腕 | `overall.speeds.wrist_kmh` | km/h |
| 转髋 | `overall.speeds.hip_kmh` | km/h |
| 来球 | `overall.speeds.ball_in_kmh` | km/h |
| 出球 | `overall.speeds.ball_out_kmh` | km/h |
| 最快拍头（脚注） | `overall.speeds.swing_kmh_max` | km/h |

Public `/api/jobs/{id}/result` also returns:

- `axes[]` — `{ key: balance\|contact\|chain\|effect, score, max, tip }`
- `speeds` — `{ racket_kmh, wrist_kmh, hip_kmh, ball_in_kmh, ball_out_kmh, racket_kmh_max, swing_from }` or `null`

Fallbacks: clip `summary.speeds` / swing `speeds` if overall missing. UI shows `—` / empty note when absent — never invents numbers.

## Mac four-surface deploy

```bash
git fetch origin cursor/report-four-dim-908f && git checkout cursor/report-four-dim-908f
bash deploy/report-four-dim/scripts/mac-four-surface-release.sh
# or with local packs:
LOCAL_APK=... LOCAL_IPA=... LOCAL_MP_ZIP=... \
  bash deploy/report-four-dim/scripts/mac-four-surface-release.sh
```

Hosts: GPU `47.93.203.28` (`/tai`), web `8.216.53.29` (`/opt/tennis-ai` + `/var/www/apk`).  
Auth: Keychain `voice-diary-prod-ssh` + `sshpass`.

## Preview

`deploy/report-four-dim/preview/index.html` → after apply:  
https://yqchen.blog/tennis/report-four-dim-preview.html
