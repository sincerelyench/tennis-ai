# ZQ-145 · 约球成功：未录分排在前面

## 规则

「约球成功」列表分两组：

1. **未录分 / 未完赛**（尚无待确认或已确认比分）——整组在前，组内按应战时间新→旧
2. **已录分**（pending 或 confirmed）——整组在后，组内同样按时间新→旧

严格跟库；不折叠；不写库。

## Kit

| 路径 | 作用 |
| --- | --- |
| `opt-patch/lib/match-scores.ts` | `findEnteredScoreBetween` |
| `opt-patch/lib/match-intros.ts` | `listIntrosForUser` success 排序 |
| `opt-patch/components/friends-view.tsx` | `orderSuccessRecords` + `data-match-success-sort="unscored-first"` |
| `scripts/apply-on-server.sh` | backup → copy → build → restart |
| `preview/index.html` | 静态示意 |
| `mp-patch/YUEQIU-SORT-UNSCORED-NOTE.txt` | 四端说明 |

## Apply

```bash
scp -r deploy/yueqiu-sort-unscored root@HOST:/tmp/
ssh root@HOST 'bash /tmp/yueqiu-sort-unscored/scripts/apply-on-server.sh /opt/tennis-ai'
```

## Verify

- DOM：`data-match-success-sort="unscored-first"`
- 行序：所有 `data-match-success-scored="false"` 出现在任何 `="true"` 之前
- Preview：`https://yqchen.blog/yueqiu-sort-unscored.html`
