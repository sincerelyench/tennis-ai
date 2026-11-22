# ZQ-167 · 注册选学员/教练；登录不选

## Why

Yanqing: 注册时需要选择是教练还是学员，登录时不需要选。

Previously the 学员/教练 chips lived on the **Sign in** tab (mostly for demo-coach phone fill). Signup always created `player` via `roleForPhone`.

## Fix

1. Remove role switch from **登录**
2. Add role switch on **注册** (学员 / 教练)
3. `POST /api/auth/register` accepts `role`; `registerWithPassword(..., role)` persists it

## Apply

```bash
bash deploy/signup-role-picker/scripts/apply-on-server.sh /opt/tennis-ai
```

## Verify

- `/tennis/login` → 注册：见 `data-signup-role`；提交 body 含 `role`
- 登录：`data-signin-no-role`；无学员/教练切换
