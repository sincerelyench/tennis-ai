# Web username / password login

Live fix for `https://yqchen.blog/tennis/login`.

## Problem

After the Postgres user-db migration (#54), the login page still only accepted **phone + 4-digit code**. There was no username/password path, so entering a username into the phone field returned `Enter an 11-digit phone number` — login looked fully broken.

Phone OTP APIs were still healthy (`/api/auth/code` returns the on-page code; `/api/auth/login` with that code works).

## Fix

- Login UI tabs: **Username & password** (default) + **Phone & code**
- `POST /api/auth/login` accepts `{ username, password }` as well as `{ phone, code }`
- New username auto-registers (`u_<username>` account key); passwords stored as scrypt in `auth_blob`
- Existing phone accounts can set a first password by signing in with the **phone number** as username

## Apply

```bash
bash deploy/web-password-login/scripts/apply-on-server.sh
```

## Verify

```bash
curl -sS -X POST https://yqchen.blog/tennis/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"zqdemo","password":"demo1234"}'
```
