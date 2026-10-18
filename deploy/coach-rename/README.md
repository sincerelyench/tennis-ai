# Coach display rename → 掌球教练

Production Next+uni-app for `https://yqchen.blog/tennis` lives on `8.216.53.29:/opt/tennis-ai` (not in this thin algo repo). Live bundles still show **Poppy / Coach Dongdong / 东东教练**.

## Target copy

| Locale | `roster.poppy.name` | `roster.poppy.short` |
| --- | --- | --- |
| zh | 掌球教练 | 掌球教练 |
| en | Zhangqiu Coach | Zhangqiu Coach |

Cue / persona prefixes follow the same names. Product brand **涨球** is unchanged. Internal coach id `poppy` may stay.

Exact string pairs: `replacements.json`. Reconstructed message object: `messages-target.json`.

## Apply on the server

```bash
# from a host that can SSH as root@8.216.53.29
scp -r deploy/coach-rename root@8.216.53.29:/tmp/coach-rename
ssh root@8.216.53.29 'bash /tmp/coach-rename/apply-on-server.sh'
```

The script patches matching source/i18n files and `.next/static/chunks/*.js`, backs up originals under `/opt/tennis-ai/.coach-rename-backup-*`, rebuilds when possible, and restarts `tennis-ai`.

## This VM

No SSH private key to `8.216.53.29` — ship is merge-ready here; live cutover needs Mac worker or authorized key.
