# 约球成功：已录分内联 + 同对手去重（ZQ-104）

叠在线上 `friends-view` / `match-intros` 之上。

## 产品规则

- 「约球成功」只列已应战成功的约球。
- **未录分**：行内「录入比分」（表单折叠）。
- **已录分**：行内比分 / 胜者 / 时间，无「录入比分」。
- **同一对手只显示最新一条**（重匹归档的旧 replied 不重复）。
- 不另开「比分记录」；待应战邀请仍在新邀请。

## 改动文件

| 文件 | 作用 |
|------|------|
| `opt-patch/components/friends-view.tsx` | 内联成绩；`dedupeSuccessRecords`；`data-match-success-deduped` |
| `opt-patch/lib/match-intros.ts` | `dedupeSuccessfulIntros`（按无向 phone 对 / 对手名） |
| `opt-patch/lib/i18n/messages.ts` | 约球成功相关文案 |
| `scripts/cleanup-ivy-dupes.*` | **默认拒绝执行**；未获 Yanqing 事先同意不得删/改线上库 |

## Apply（谨慎）

**只部署 UI/API 去重**（展示层折叠同对手；不写库）。

先确认 `systemctl is-active tennis-ai` 为 active，再：

```bash
bash deploy/yueqiu-scored-success/scripts/apply-on-server.sh /opt/tennis-ai
```

`cleanup-ivy-dupes.on-server.sh` 会直接 exit 2。若仍需删库内旧 Ivy intro，须经 coordinator 取得 Yanqing 事先同意后再做。

Preview: https://yqchen.blog/yueqiu-scored-success.html
