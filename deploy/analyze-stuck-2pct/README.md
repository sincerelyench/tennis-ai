# Analyze stuck at ~2% — auth gate + submit diagnosis

## What "2%" means

`AnalyzeProgress` / `jobPercent(job, submitting=true)` shows **2%** while the client is still in the **submitting** phase (upload to `/tai/api/analyze` has not returned a `job_id` yet). This is by design (see live preview `analyze-progress-preview.html`).

## Live findings (cloud VM, 2026-11-05)

| Layer | Result |
| --- | --- |
| GPU `/tai/api/health` | 200, `busy=false`, CUDA ok |
| POST `/tai/api/analyze` (field `video`) | Creates job; completes (fast/full) |
| Hotfix #55 `taiFetch` timeout | Live chunk default **900s** (`9e5`) |
| HTML pages with valid `tennis_session` | **307 → `/tennis/login`** (no `next=`) |
| `GET /api/auth/session` with same cookie | **200** |
| Middleware cookie presence | OK (non-page paths with cookie are not bounced to login) |

**Root cause of the user-visible stall:** after login, App Router **layout/page** redirects to login (likely `getSession(cookies())` fails / empty cookies in RSC) while API session works. Users cannot stably open `/tennis/analysis`; any in-flight submit UI stays at the submitting **2%** marker. GPU/nginx path from this VM is healthy.

Secondary: onboarding modal (`localStorage` key `tennis-onboarded`) can cover the login form until dismissed.

## Apply on prod (needs SSH)

Mac Keychain `voice-diary-prod-ssh` or `SSHPASS`:

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
# or: export SSHPASS="$(tr -d '\n' < ~/.ssh/voice-diary-prod)"
bash deploy/analyze-stuck-2pct/scripts/mac-apply.sh
```

On the server directly:

```bash
bash deploy/analyze-stuck-2pct/scripts/apply-on-server.sh /opt/tennis-ai
```

## Four-surface

Web / APK WebView / iOS shell / 小程序 web-view all load `yqchen.blog/tennis` — no native rebuild once Next is rebuilt.
