# Journey: remove「投影」

成长旅程 `/journey` 不再在「现在」或对阵行显示「投影」/(P)。只展示数字等级分。

## Apply

```bash
export SSHPASS='…'   # voice-diary-prod-ssh
bash deploy/journey-remove-projection/scripts/apply-web.sh
```

## Verify

- `/tennis/journey` summary「现在」只有如 `6.5`，无「投影」
- 有比赛时成绩行 `等级分 a → b` 无投影标记
- 约球排行 (P) 不在本改动范围

## Surfaces

Web 为源；APK / IPA / 微信小程序 WebView 同源继承，不重打壳。
