# Official UTR-style ladder (ZQ-71)

Replace Elo-like K≈0.42 step with a documented **UTR-style** approximation:

games % vs expected → match rating → weighted average of ≤30 matches / 12 months.

Not Universal Tennis / official UTR. Product copy:「UTR 风格 / 等级分」.

## Apply on production

```bash
# from repo root after syncing deploy/official-utr-ladder to the server
bash deploy/official-utr-ladder/scripts/apply-on-server.sh /opt/tennis-ai
```

## Files

- `opt-patch/lib/local-ladder.ts` — core algorithm + history replay
- `opt-patch/lib/matchmaking.ts` — pass `projected`
- `opt-patch/lib/i18n/messages.ts` — ? help / howBody (zh first)
- `opt-patch/components/friends-view.tsx` — (P) on ladder
- `opt-patch/components/journey-view.tsx` — (P) + excluded hint
- `opt-patch/app/api/friends/ladder|rating-history` — projected fields

## Tests

```bash
python3 -m unittest tests.test_official_utr_ladder -v
```
