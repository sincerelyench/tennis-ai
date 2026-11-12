# Profile dialog gate (完善资料)

## Bug
`ProfileSetup` opened when **either** `displayName` **or** `cityId` was empty. Logged-in users who already had a display name could still see 「完善资料」 whenever city was missing or not yet hydrated — odd popup on restore / friends / coach / me.

## Fix
Unified condition (server + client):

1. **Not logged in** → never show `ProfileSetup` (normal login/register).
2. **Logged in + has display name** → never show, even if `cityId` is empty.
3. **Logged in + missing/empty display name** → show dialog; form still collects **name + city** for new users.

Files:

- `opt-patch/lib/auth-store.ts` — `needsProfileSetup` checks display name only
- `opt-patch/lib/session-role.ts` — expose `needsProfileSetup` + `hydrated`; wait for session restore
- `opt-patch/components/profile-setup.tsx` — gate on hydrated + phone + missing name (not city)

## Apply

```bash
# from this kit (on the Next host):
bash scripts/apply-on-server.sh /opt/tennis-ai

# or from a laptop / cloud VM with SSHPASS:
SSHPASS=… bash scripts/apply-on-server.sh
```

APK / IPA / mp-weixin load the same `/tennis` WebView — no shell rebuild required for this gate.
