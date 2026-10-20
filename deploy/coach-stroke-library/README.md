# 涨球教练 · 动作库 / 我的示范

Coach-owned per-stroke **text/prompt** + **demo video** for all 8 analyze strokes:
`fh-topspin`, `fh-slice`, `fh-volley`, `bh-topspin`, `bh-slice`, `bh-volley`, `serve`, `smash`.

Display name: **涨球教练** / Zhangqiu Coach (not Poppy / 东东).

## What’s in this folder

| Path | Role |
| --- | --- |
| `opt-patch/` | Drop-in Next + uni-app sources for `/opt/tennis-ai` |
| `preview/index.html` | Local interactive preview (localStorage + file upload) |
| `scripts/apply-to-opt-tennis-ai.sh` | Copy patch onto a full app tree |

Also shipped in this repo:

- `miniprogram/pages/coach-library/` — native WeChat page
- `miniprogram/utils/coach-stroke-library.js` — shared storage helper

## Persistence

- Client: `localStorage` / `wx` key `tennis-coach-stroke-library-v1` (same pattern as `tennis-coach-opinions-v1`)
- Server (after apply): `.data/coach-library.json` + `public/coach-demos/*`
- APIs: `GET/PUT/DELETE /tennis/api/coach/library`, `POST /tennis/api/coach/library/upload`

## Deploy (needs SSH to `8.216.53.29`)

This cloud VM has **no deploy private key**. Live Next source lives only at `/opt/tennis-ai`.

On a machine that can SSH as root:

```bash
scp -r deploy/coach-stroke-library root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/coach-stroke-library/scripts/apply-to-opt-tennis-ai.sh /opt/tennis-ai'
# merge i18n + nav (see script echo), then:
ssh root@8.216.53.29 'cd /opt/tennis-ai && sudo -u tennis npm run build && systemctl restart tennis-ai'
```

Optional APK rebuild on Mac/HBuilder after uni-app page is registered.

## Preview without deploy

Open `preview/index.html` in a browser (or serve the folder). Upload text + video per stroke; state persists in localStorage.

## Analysis hook

`opt-patch/lib/coach-library-analysis-hook.ts` → `fetchCoachLibraryDemo` / `analysisPromptInjection`.
Wire into report correct-form video + coach chat when `/opt` tree is available.
