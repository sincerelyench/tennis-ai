# ZQ-122 赢弱敌分数不变

## Product
- Primary: algorithm — win vs much weaker → rating **unchanged** (Δ≈0); gains mainly from similar-level wins.
- Secondary: journey UI hint if a win still shows negative Δ:「赢球掉分：对手比自己弱」.

## Formula change (softest)
1. `EXCLUDE_GAP` **2.0 → 1.0**: favorite win with |Δ| > 1.0 ignored (covers ~NTRP 3.0 vs 2.5 / 陈燕青 vs Ivy).
2. Winner match-rating floor: `mrWin = max(computed, preMatchSideRating)` so a counted win never lowers published rating.

## Apply
```bash
bash deploy/win-drop-weak-opponent/scripts/apply-on-server.sh /opt/tennis-ai
```

## Tests
```bash
python3 -m unittest tests.test_win_drop_weak_opponent -v
```

## Four-surface
Web deploy required. APK/IPA/mp WebView load live `/tennis` — no binary rebuild for this server-side rating math + journey copy.
