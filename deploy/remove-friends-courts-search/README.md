# Remove 搜索球友 / 搜索球场

Product: **涨球**. Do not rename 掌球教练. No level picker changes.

Removes the Friends-tab search box that filtered by friend name **or** court/venue (`friends.searchPh` = “搜索球友或球场” / “Search friends or courts”). Keeps local ladder + friend list.

## Why this folder

This thin GitHub repo does not contain the production Next + uni-app tree (`/opt/tennis-ai` on `8.216.53.29`). Same pattern as `deploy/coach-rename/` and `deploy/coach-stroke-library/`.

## Apply on production

```bash
scp -r deploy/remove-friends-courts-search root@8.216.53.29:/tmp/remove-friends-courts-search
ssh root@8.216.53.29 'bash /tmp/remove-friends-courts-search/apply-on-server.sh'
```

Or with an explicit root:

```bash
TENNIS_AI_ROOT=/opt/tennis-ai bash apply-on-server.sh
```

The script:

1. Backs up matched files under `$ROOT/.remove-friends-search-backup-<stamp>/`
2. Surgically edits `components/friends-view.tsx` / `apps/uniapp/.../friends/index.vue` / i18n messages when present
3. Patches built `.next/static/chunks/*.js` (removes the search `Input`, clears search copy)
4. Rebuilds if `package.json` has `build`, then restarts `tennis-ai`

## Verify

- Player login → `/tennis/friends`: ladder + list, **no** search field, no “搜索球友或球场” / “Search friends or courts”
- Empty copy no longer says “换个名字或场地再试” / “Try another name or court”
- Coach display name unchanged (掌球教练)
