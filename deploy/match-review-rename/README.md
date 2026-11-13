# Match review rename — 比赛结果「集锦」→「比赛综述」

On **本地排行 → 比赛结果**, rename the row action and reshape the detail dialog.

## Product

1. Row button: 「集锦」→「比赛综述」
2. Detail dialog title: 「比赛综述」
3. Body:
   - **Has video/link**: optional text + section titled 「集锦」 for the media
   - **Text only**: section titled 「比赛综述介绍」（no empty “highlights” framing）
4. Confirm-gate unchanged (pending lock; comments after confirm)

Same `MatchReviewBody` used on: city results dialog, ladder player recent matches, 约球成功 linked score.

## Kit

- `opt-patch/components/friends-view.tsx` — `MatchReviewBody` + copy wiring
- `opt-patch/lib/i18n/messages.ts` — zh/en keys
- `scripts/apply-on-server.sh` — backup → copy → build → restart

**Depends on** live already having ZQ-121 city results list (+ ZQ-115 highlight APIs). This kit only replaces friends-view + messages.

## Deploy

```bash
bash deploy/match-review-rename/scripts/apply-on-server.sh /opt/tennis-ai
```

Code-only. No Postgres / blob writes.

## Four-surface

Web apply updates `/tennis`. APK / IPA / mini program are WebView shells → **no binary rebuild** required for this copy/UI change. Apply script writes `/var/www/apk/MATCH-REVIEW-RENAME-NOTE.txt`.
