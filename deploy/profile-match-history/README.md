# 我的 · 约球比赛成绩 Tab

## 变更

1. 「我的」页增加分区 Tab：**资料** / **约球成绩**。
2. **约球成绩**拉取 `GET /tennis/api/friends/scores` 的 **confirmed** 列表；无记录显示空状态（0）。
3. 不恢复底部「分析」Tab（`SHOW_ANALYSIS_TAB` 仍为 false）。

## 应用

```bash
bash deploy/profile-match-history/scripts/apply-on-server.sh /opt/tennis-ai
```

## 四端

Web `/opt/tennis-ai` 为 APK / IPA / 微信小程序 WebView 源；壳未改包时与网页一致。
