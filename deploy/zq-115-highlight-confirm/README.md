# ZQ-115：精彩集锦随比分确认

Parent: ZQ-100 / PR #106. Clarified product (Yanqing):

- 录分时可附**精彩集锦** + **文字描述**
- **须与比分一起经对方同意**才生效（pending → confirm 同一闸门）
- 确认后其他登录用户可**评论**
- 本地排行点用户名 → 最近战绩弹窗也能看到集锦 / 描述 / 评论

## Gap vs PR #106 / prior live

| Piece | Before | ZQ-115 |
|-------|--------|--------|
| Highlight attach | Anytime after score by participants | Only while **pending**; frozen after confirm |
| Confirm gate | Score only | Score **+** highlight + description |
| Comments | Allowed on non-confirmed | **Confirmed only** |
| Ladder modal | Score lines only | + highlight / desc / comments |
| player-matches API | Ladder rows only | Enriched with media + comments |

## Apply (code only — normal product writes only)

```bash
scp -r deploy/zq-115-highlight-confirm root@HOST:/tmp/
ssh root@HOST 'bash /tmp/zq-115-highlight-confirm/scripts/apply-on-server.sh /opt/tennis-ai'
```

No wipe scripts. No casual DB migrations.
