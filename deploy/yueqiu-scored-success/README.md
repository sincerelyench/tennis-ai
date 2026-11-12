# 约球成功：已录分内联展示（不另开比分记录）

叠在线上 `friends-view`（含 ZQ-75/77/78 弹窗战绩）之上。

## 产品规则（2026-11-12）

- 「约球成功」只列已应战成功的约球。
- **未录分**：行内显示「录入比分」（表单默认折叠，点开再填）。
- **已录分**：行内直接展示比分 / 胜者 / 时间，**不再**显示「录入比分」。
- **不保留**单独的「比分记录 / 比赛记录」区块。
- 待应战邀请仍在新邀请收件箱，不进约球成功。

## 改动文件

| 文件 | 作用 |
|------|------|
| `opt-patch/components/friends-view.tsx` | 成功行按对手匹配成绩；去掉 `data-score-history`；表单仅点开后出现 |
| `opt-patch/lib/i18n/messages.ts` | 「录入比分」文案；记录区标题对齐「约球成功」 |

## Apply

```bash
bash deploy/yueqiu-scored-success/scripts/apply-on-server.sh /opt/tennis-ai
```

Preview: https://yqchen.blog/yueqiu-scored-success.html

Web 为 APK / IPA / mp-weixin WebView 源，部署 Web 即四端生效。
