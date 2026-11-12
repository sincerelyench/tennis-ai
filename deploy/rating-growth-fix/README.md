# rating-growth-fix (ZQ-105)

Fixes:
1. Ladder showed 陈燕青 as **7.5** because duplicate `u_111` had no level and defaults used **3.5 → seed 7.5**. Real account `18662147197` is level **3 → 6.5**.
2. 成长旅程 showed MainError 「训练数据暂时不可用」 during broken/mid-build chunk races; harden defaults + clearer error copy; ensure rating-history path works.

Apply:
```bash
bash deploy/rating-growth-fix/scripts/apply-on-server.sh /opt/tennis-ai
```
