# unproven-rating-note

## What

Local ladder: for players with **no confirmed matches**, keep a plain numeric rating (no trailing `?` / no italic score) and show a **small caption** under the score:

- zh: 「评分未经比赛证明」
- en: 「Rating not yet proven by matches」

Also show the same caption in the player-detail dialog header. Keep UTR / 水平 help `?` icons.

Base: live `/opt/tennis-ai` after ZQ-117 (`ladder-no-unplayed-q`) friends-view + messages.

## Apply (code only — no DB)

```bash
scp -r deploy/unproven-rating-note root@HOST:/tmp/
ssh root@HOST 'bash /tmp/unproven-rating-note/scripts/apply-on-server.sh /opt/tennis-ai'
```

Build completes **before** `systemctl restart`.

## Four-surface

WebView clients (APK / IPA / mp) load live `/tennis`; after web apply they pick up this UI. Drop a note under `/var/www/apk/UNPROVEN-RATING-NOTE.txt`.
