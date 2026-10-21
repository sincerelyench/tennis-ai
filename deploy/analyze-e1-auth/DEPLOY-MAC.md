# Mac: deploy analyze-fail E1 auth fix

```bash
bash /cursor/stores/bc-f98fd786-b5b4-41c4-9e5b-4a743d4f7816/media/analyze-fail-20261021/deploy/scripts/mac-apply-and-probe.sh
```

Or from a checkout of PR branch `cursor/analyze-e1-auth-optional-9e7f` after copying `deploy/` scripts.

Expect: POST `/tennis/api/analyze` + `client=miniprogram` → **200** (was 401 `auth_required`).
