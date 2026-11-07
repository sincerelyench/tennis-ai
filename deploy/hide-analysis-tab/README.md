# Temporarily hide Analysis tab

Hides bottom-nav 「分析」 / Analyze while keeping routes and backend code.

## Flag

`lib/feature-flags.ts`:

- `SHOW_ANALYSIS_TAB = false` — hide tab + soft-redirect `/analysis*` and `/reports` to 约球 (`/friends`)
- Set to `true` and rebuild to restore

## Behavior

- Bottom nav (player): 约球 → 教练 → 我的
- `/analysis`, `/analysis/new`, `/analysis/match` → redirect `/friends`
- 「我的」菜单里的分析/报告入口一并隐藏
- Coach nav unchanged; analyze APIs untouched
- APK / IPA / mp-weixin shells load the web app — web is source of truth

## Apply on production

```bash
bash deploy/hide-analysis-tab/scripts/apply-on-server.sh /opt/tennis-ai
```
