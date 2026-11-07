# Restore in-app analysis UI

Reverts the PR #68 sslip **iframe** embed on `/analysis` and `/analysis/new`.

## Behavior

- In-app flow again: stroke pick → upload → trim → `/tai` progress → report
- Backend remains the GPU stack behind `https://tennis.47.93.203.28.sslip.io/` via existing nginx `/tai` → `http://47.93.203.28/tennis-ai/`
- `?job=<id>` on `/analysis` or `/analysis/new` starts the in-app job watcher (no external page)
- `/analysis/match` untouched

## Apply on production

```bash
# from repo checkout that contains this folder
bash deploy/restore-analyze-inapp/scripts/apply-on-server.sh /opt/tennis-ai
```
