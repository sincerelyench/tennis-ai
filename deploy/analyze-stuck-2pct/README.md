# Analyze stuck at ~2% — auth gate hotfix

## What 2% means
`AnalyzeProgress` shows **2%** while `submitting=true` (upload has not returned a `job_id`).

## Live root cause (fixed on 8.216.53.29)
`app/(main)/layout.tsx` called `getSession(cookies())`. Route Handler and RSC hold **separate** module-level auth caches; after login, RSC still saw a stale snapshot and redirected to `/login` (307, no `next=`). API `/api/auth/session` stayed 200. Users could not open analysis; any submit UI stayed at the designed 2% marker.

## Fix applied live
- `lib/auth-store.ts` — on session miss, `invalidateAuthCache()` + reload from Postgres once
- `app/(main)/layout.tsx` — `force-dynamic` + Cookie header fallback
- `components/login-view.tsx` — hard `location.assign` after login
- Re-assert nginx `/tai` streaming snippet (#55)

## Apply
```bash
bash deploy/analyze-stuck-2pct/scripts/mac-apply.sh
# or on server:
bash deploy/analyze-stuck-2pct/scripts/apply-on-server.sh /opt/tennis-ai
```

Prefer copying `opt-patch/` files onto the server (layout + auth-store) then `npm run build` + restart.
