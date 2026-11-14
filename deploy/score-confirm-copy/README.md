# Score confirm copy — 集锦等对方确认 → 比赛结果和综述等对方确认

After submitting a score for confirmation, pending/confirm UI must **not** say 「集锦等对方确认」. It says the **比赛结果和综述** are waiting for the opponent (e.g. 「比赛结果和综述等对方确认」).

## Product

| Surface | Before | After |
| --- | --- | --- |
| Toast / mine-pending list (`scorePendingHint`) | 已提交，等待对方确认。 | **比赛结果和综述等对方确认。** |
| Pending note (`highlightPendingNote`) | 集锦待对方确认 | **比赛结果和综述等对方确认** |
| Entry hint (`highlightWithScoreHint`) | 集锦与描述随比分一起… | **比赛结果和综述随比分一起…** |
| Add / edit / saved / fail | 精彩集锦 / 编辑集锦 / … | **比赛综述** wording |
| Desc placeholder | 比赛描述（可选） | **比赛综述介绍（可选）** |
| API 403 (pending media) | 集锦待对方确认后可见 | **比赛结果和综述待对方确认后可见** |
| Video section (`cityResultsVideoSection`) | 集锦 | **集锦**（keep） |
| Open link (`highlightOpenLink`) | 打开集锦 | **打开集锦**（keep） |

「集锦」 remains only as the **video block title** inside 比赛综述 (ZQ-132) and the open-link label.

## Kit

- `opt-patch/lib/i18n/messages.ts` — zh/en confirm-waiting + entry copy
- `opt-patch/app/api/friends/scores/[id]/highlight/route.ts` — pending 403 message
- `scripts/apply-on-server.sh` — backup → copy → build → restart

Based on live `/opt/tennis-ai` snapshot (post score-video-upload / hide-ladder).

## Deploy

```bash
bash deploy/score-confirm-copy/scripts/apply-on-server.sh /opt/tennis-ai
```

Code-only. No Postgres / blob writes.

## Four-surface

Web apply updates `/tennis`. APK / IPA / mini program are WebView shells → **no binary rebuild** required. Apply script writes `/var/www/apk/SCORE-CONFIRM-COPY-NOTE.txt`.
