# Profile dialog gate (完善资料)

## Product rule (2026-11-12)
Show 「完善资料」 **only** when logged in and missing required key fields:
**display name** and/or **city**. Otherwise never show — including after F5 / cold load / tab return. Not logged in → normal login/register only.

## Fix
1. Server `needsProfileSetup` = missing display name **or** missing city (form-required keys).
2. Client waits for `hydrated` from `/api/auth/session` before deciding — never opens on a transient empty snapshot.
3. Persist `tennis-ai-profile-complete-v1` when name+city are present so complete users are not re-prompted across refresh.

## Files
- `opt-patch/lib/auth-store.ts`
- `opt-patch/lib/session-role.ts`
- `opt-patch/components/profile-setup.tsx`

## Apply
```bash
SSHPASS=… bash scripts/apply-on-server.sh
# or on host:
bash scripts/apply-on-server.sh /opt/tennis-ai
```
