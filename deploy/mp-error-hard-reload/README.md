# ZQ-164c · 小程序排行榜 error.tsx 卡住

## Root cause

Yanqing screenshot: bottom **排行榜** active, chrome title still **我的 · 涨球乐**, red `(main)/error.tsx`「页面没有加载出来」.

That is **soft-nav ChunkLoad / stuck error boundary** in WeChat web-view (same class as ZQ-160), **not** empty ladder DB.

- `mp-enter` default `next=/` → 我的; tab uses Next `<Link>` soft-nav → `/ladder`
- After rebuild, web-view may keep old client graph → `ChunkLoadError`
- **「再试一次」only called `reset()`** → never fetches current BUILD chunks → stuck forever
- Copy「训练数据暂时不可用」is shared `(main)` i18n (analysis-era), **not** wrong page

## Fix

1. `error.tsx`: ChunkLoad auto `location.reload()` once; button always hard reload
2. `app-shell` bottom tabs: under MicroMessenger, `location.assign(/tennis/…)` instead of soft-nav
3. i18n `error.pageDesc` → generic「页面暂时不可用…」

## Apply

```bash
bash deploy/mp-error-hard-reload/scripts/apply-on-server.sh /opt/tennis-ai
```
