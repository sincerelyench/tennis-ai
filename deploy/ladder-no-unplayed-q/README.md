# ladder-no-unplayed-q (ZQ-117)

## What

Remove local-ladder unplayed/untested score presentation:

- Do **not** append `?` to ratings for players with no confirmed matches.
- Do **not** italicize those scores or show the 「尚未经过比赛考验」 hint (tooltip / inline).
- Keep normal numeric ratings for named players.
- Keep separate UTR / 水平 help `?` icons that explain the rating system.

Base: live `/opt/tennis-ai` friends-view (ZQ-115 byte-identical) + messages.ts.

## Apply (code only — no DB)

```bash
scp -r deploy/ladder-no-unplayed-q root@HOST:/tmp/
ssh root@HOST 'bash /tmp/ladder-no-unplayed-q/scripts/apply-on-server.sh /opt/tennis-ai'
```

Build completes **before** `systemctl restart`.

## Four-surface

WebView clients (APK / IPA / mp) load live `/tennis`; after web apply they pick up this UI. Drop a note under `/var/www/apk/LADDER-NO-UNPLAYED-Q-NOTE.txt`.
