# Friends ladder → UTR-like (not NTRP)

Production Next + uni-app for `https://yqchen.blog/tennis` lives on `8.216.53.29:/opt/tennis-ai` (not in this thin algo repo). Live friends ranking **already uses** the UTR-like `rateLadder` math (`seed = self-level × 2.15`, Elo-style match updates). UI copy and friend-card labels still say **NTRP**.

This branch is based on [PR #10](https://github.com/sincerelyench/tennis-ai/pull/10) (remove 搜索球友/球场). Apply **remove-search first** (or use this combined branch), then `friends-utr` so ladder copy does not reintroduce search.

## What this ships

| Artifact | Purpose |
| --- | --- |
| `local-ladder.ts` | Documented UTR-like formula + sample roster/matches (install to `lib/` and uni-app) |
| `i18n-replacements.json` | zh/en friends ladder strings: NTRP → UTR |
| `apply-on-server.sh` | Patch source + `.next/static/chunks`, optional rebuild, restart `tennis-ai` |
| `preview.html` | Offline UI proof: UTR ladder (no search box), no NTRP on ranking surface |

Also updates `deploy/remove-friends-courts-search/preview/friends-no-search*.html` so the no-search mock shows **UTR** instead of NTRP. Does **not** rename 掌球教练 / 涨球.

## Target copy (friends.*)

| Key | en | zh |
| --- | --- | --- |
| `rankLead` | Ranked by a UTR-like rating (not NTRP)… | 按类 UTR 分数排名（不用 NTRP）… |
| `seedOnly` | UTR {n} · no matches yet | UTR {n} · 还没有比赛 |
| `emptyRankDesc` | …off the UTR seed. | …离开 UTR 种子分。 |
| `howBody` | Seed = self-level × 2.15 on a UTR-like scale… | 起点是自评水平 × 2.15（类 UTR）… |

Friend list subtitle: `UTR {seed}` (seed = round1(selfLevel × 2.15)), not `NTRP {ntrp}`.
Ladder `seedOnly` interpolation uses `row.seed` (UTR scale), not raw self-level.

## Apply on the server

```bash
# from a host that can SSH as root@8.216.53.29
scp -r deploy/friends-utr root@8.216.53.29:/tmp/friends-utr
ssh root@8.216.53.29 'bash /tmp/friends-utr/apply-on-server.sh'
```

Backup under `/opt/tennis-ai/.friends-utr-backup-*`.

## This VM

No SSH private key to `8.216.53.29` — ship is merge-ready here; live cutover needs Mac worker or authorized key. Evidence preview: `preview.html` / store `media/friends-utr-rank-20261020/`.
