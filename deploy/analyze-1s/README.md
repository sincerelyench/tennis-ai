# 涨球 · 分析 ≤1s 快速路径（四端同步）

Brand: **涨球** / **涨球教练**. Stroke ids (`serve`, `fh-topspin`, …) stay as submitted.

## What ships

| Surface | Artifact / target | Change |
| --- | --- | --- |
| **Web** | `8.216.53.29:/opt/tennis-ai` + GPU `/tai` | Faster poll, honest ETA, sample/content-hash cache, `fast=1` |
| **Android APK** | `tennis-ai.apk` → nginx | Same uni-app analysis poll/fast + rebuild |
| **iOS IPA** | `tennis-ai.ipa` → nginx | Same uni-app shell rebuild |
| **WeChat** | `mp-weixin.zip` + `mp-weixin-README.txt` | Same poll/fast in mp build |

## Honest limits

- **≤1s achieved for:** sample **cache hit** (inline `report` in `/api/analyze`) and **content-hash** identical re-upload; target also **short-clip fast path** (≤6s auto / `fast=1`, first 4s, no overlay encode / clip cut / coach LLM).
- **Not ≤1s:** full HD multi-clip + overlay + 涨球教练 LLM (still minutes). ETA labels stay in minutes for `analyze_mode=full` — no fake timers.

## Mac deploy (one shot)

```bash
# From repo root on yanqing Mac (Keychain voice-diary-prod-ssh + sshpass):
bash deploy/analyze-1s/scripts/apply-all-four-surfaces.sh
```

Env overrides:

| Var | Default |
| --- | --- |
| `WEB_HOST` | `root@8.216.53.29` |
| `GPU_HOST` | `root@47.93.203.28` |
| `OPT_ROOT` | `/opt/tennis-ai` |
| `GPU_ROOT` | `/root/workspace/tennis-ai` |
| `SKIP_NATIVE` | `0` — set `1` to skip APK/IPA/mp rebuild |

## Manual pieces

1. **GPU** — `scripts/apply-gpu.sh` copies `web/app.py`, `pipeline/*`, `web/static/*`, `i18n/*`, restarts API.
2. **Web Next** — `scripts/apply-web.sh` patches poll interval + job-progress ETA copy under `/opt/tennis-ai`, `npm run build`, restart.
3. **Native four-pack** — `scripts/build-and-upload-native.sh` builds uni-app → APK / IPA / mp-weixin.zip and uploads to `/var/www/apk/`.

## Probe after deploy

```bash
bash deploy/analyze-1s/scripts/probe-latency.sh
```

Writes timing JSON under `media/analyze-1s-20261020/` when `EVIDENCE_DIR` is set.
