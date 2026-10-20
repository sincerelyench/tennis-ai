# 涨球 · 教练发布 → 球员选择

Coach library materials → **backend style training (stub OK)** → **publish** → players **select published coaches**.

Default persona display name: **涨球教练** / **Zhangqiu Coach** (not Poppy / 东东 / Poppy教练). Published coaches may set their own style name.

## Status machine

`draft` → `queued` / `training` → `ready` → `published` | `rejected`

CTAs: **提交训练** / **申请发布** / **撤回**

Training is an honest async stub (`TRAIN_STUB_MS` ≈ 8s): poll advances queued → training → ready. Real GPU train hooks the same `/api/coach/train` + status fields later.

Platform accept is stubbed as auto-accept on 申请发布 (`autoAccept: true`); `accept` / `reject` actions remain for a real review queue.

## APIs (after apply → `/tennis/api/...`)

| Method | Path | Role |
| --- | --- | --- |
| GET/POST | `/api/coach/train` | Enqueue / poll stub train |
| GET/POST | `/api/coach/publish` | Status + request / withdraw / accept / reject |
| GET | `/api/coaches?published=1` | Published coaches for picker |
| GET/PUT | `/api/player/coach` | Player selected coach |

Persistence: `.data/coach-publish.json`, `.data/player-selected-coach.json` (+ client `tennis-coach-publish-v1`, `tennis-player-selected-coach-v1`).

## What’s in this folder

| Path | Role |
| --- | --- |
| `opt-patch/` | Drop-in for `/opt/tennis-ai` |
| `preview/index.html` | Interactive coach desk ↔ player picker |
| `scripts/apply-to-opt-tennis-ai.sh` | Copy onto full app tree |

Also in repo:

- `miniprogram/pages/coach-library/` — publish CTAs on library page
- `miniprogram/pages/coach-picker/` — player picker
- `miniprogram/utils/coach-publish.js`

Depends on stroke-library patch (PR #7) for `/library` UI + library JSON. Coordinate rename PR #8 (Mac deploying) for remaining Poppy/东东 copy elsewhere.

## Deploy (needs SSH)

This cloud VM has **no deploy private key**.

```bash
# 1) stroke library (if not already)
scp -r deploy/coach-stroke-library root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/coach-stroke-library/scripts/apply-to-opt-tennis-ai.sh /opt/tennis-ai'

# 2) publish + select
scp -r deploy/coach-publish-select root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/coach-publish-select/scripts/apply-to-opt-tennis-ai.sh /opt/tennis-ai'

# merge i18n + nav, then:
ssh root@8.216.53.29 'cd /opt/tennis-ai && sudo -u tennis npm run build && systemctl restart tennis-ai'
```

## Preview without deploy

Open `preview/index.html`: save sample prompt → 提交训练 → wait ready → 申请发布 → switch to 球员选教练 → 选用.

## Evidence

Store: `/cursor/stores/bc-f98fd786-b5b4-41c4-9e5b-4a743d4f7816/media/coach-publish-select-20261020/`
