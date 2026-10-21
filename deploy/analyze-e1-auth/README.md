# Analyze-fail fix — E1 auth optional on GPU

## Root cause
`/tennis/api/analyze` proxies to `/tai` and **strips Authorization**, but still forwards `client=miniprogram|android|ios`. GPU `_prepare_upload_meta` required a GPU dev-mock token for those clients → **401 `auth_required`**. Sample/`client` empty paths worked.

## Fix
GPU-only: E1 clients no longer require a GPU token; invalid/non-GPU bearers (e.g. `tennis_session`) are ignored. Guide metadata still attaches; valid GPU token still sets `user_id`.

**No APK / IPA / mp-weixin rebuild required** for this fix (four-surface sync N/A for auth harden). Stroke passthrough unchanged.

## Mac apply
```bash
bash media/analyze-fail-20261021/deploy/scripts/mac-apply-and-probe.sh
# or:
bash media/analyze-fail-20261021/deploy/scripts/apply-gpu.sh
```
Keychain: `voice-diary-prod-ssh`. Host: `47.93.203.28:/root/workspace/tennis-ai`.
