# Me page: dedupe「成长旅程」

「我的」页去掉设置菜单里重复的「成长旅程」，只保留「我的数据」卡片一处入口。

## Apply

```bash
export SSHPASS='…'   # voice-diary-prod-ssh
bash deploy/my-journey-dedupe/scripts/apply-web.sh
```

## Verify

- `/tennis/profile`「我的数据」下仍有一张「成长旅程」卡片（`data-action="open-journey"`）
- 「设置」列表不再出现「成长旅程」
- 未改数据库

## Surfaces

Web 为源；APK / IPA / 微信小程序 WebView 同源继承，不重打壳。
