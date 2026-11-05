# User signup + name/location onboarding

Adds an explicit **Register** flow on https://yqchen.blog/tennis, then a blocking profile gate for **display name** and **city**. Values persist in Postgres via existing `auth` blob / `users` mirror (`PATCH /api/auth/profile`).

## Behavior

1. Login page tabs: **Sign in** / **Register**
2. `POST /api/auth/register` creates username/password accounts (no auto-create on login)
3. After signup (or any login missing name/city), `ProfileSetup` collects display name + city
4. Four surfaces share the Next UI (WebView / web-view) — web deploy covers APK/IPA/mp-weixin shells

## Apply

```bash
export SSHPASS='…'
bash deploy/user-signup-onboarding/scripts/apply-on-server.sh
```
