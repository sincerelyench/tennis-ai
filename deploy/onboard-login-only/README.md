# ZQ-165 · 退出登录点了没反应 / 登录像失灵

## Root cause

`AppShell` mounted `<Onboarding />` (`fixed inset-0 z-[80]`) after login. Preferences: 介绍弹窗只在**登录页**. Mini program `mp-enter` skips login → onboard modal covers 我的 → **退出登录 clicks hit the overlay** (pointer intercepted). Same overlay can block other taps; feels like login/logout broken. API logout/login themselves were fine.

## Fix

1. Remove `Onboarding` from `app-shell.tsx` (keep on `login-view.tsx` only).
2. Harden `logout-button.tsx`: `credentials:"include"` + `location.assign(/tennis/login)`.

## Apply

```bash
bash deploy/onboard-login-only/scripts/apply-on-server.sh /opt/tennis-ai
```
