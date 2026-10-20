# Coach display rename correction → 涨球教练

User correction (2026-10-20): default coach name is **涨球教练**, not 掌球教练, and not Poppy / 东东.

| Locale | `roster.poppy.name` | `roster.poppy.short` |
| --- | --- | --- |
| zh | 涨球教练 | 涨球教练 |
| en | Zhangqiu Coach | Zhangqiu Coach |

- Product brand **涨球** unchanged.
- Do **not** invent “Palm Ball Coach”.
- Internal coach id `poppy` may stay.

Live Next+uni-app for `https://yqchen.blog/tennis` lives on `8.216.53.29:/opt/tennis-ai` (thin algo repo here only ships the patch kit). Prior live cutover incorrectly used **掌球教练**; this kit replaces those strings (and any leftover Poppy / 东东) to **涨球教练**.

Also covers:

- coach roster / cues / persona
- library + publish/select display defaults
- `get-zhangqiu.html` download copy
- APK embedded `assets/www/**/*.js` when `tennis-ai.apk` is on the host

Exact pairs: `replacements.json`. Target message object: `messages-target.json`.

## Apply on the server (Mac SSH)

```bash
# from a host that can SSH as root@8.216.53.29
scp -r deploy/coach-rename-zhangqiu-correct root@8.216.53.29:/tmp/coach-rename-zhangqiu-correct
ssh root@8.216.53.29 'bash /tmp/coach-rename-zhangqiu-correct/apply-on-server.sh'
```

The script backs up under `/opt/tennis-ai/.coach-rename-zhangqiu-correct-backup-*`, patches source + `.next` chunks + public download pages + APK JS when found, rebuilds when possible, restarts `tennis-ai`.

## Sibling patch trees in this PR

Corrected copies (掌球教练 → 涨球教练) of:

- `deploy/coach-stroke-library/`
- `deploy/coach-publish-select/`
- `deploy/ship/get-zhangqiu.html` (+ README)
- `miniprogram/` coach-library helpers

Re-apply those kits only if the live tree still lacks the feature patches; for a host that already shows 掌球教练, running **this** `apply-on-server.sh` alone is enough for the name fix.
