# ZQ-148 · 女单性别以资料自报为准

## Bug

陈燕青在资料里设为 `male` 后仍出现在 **女单**。种子显示名允许列表（陈燕青 / Ivy / Shirley）在性别未读到或客户端兜底丢字段时，等价于盖过了显式男性选择。

## Fix

1. `isFemalePlayer`: **explicit male → false**（先于 allowlist）；explicit female → true；仅 unset 才用种子名。
2. Ladder / session / profile / directory：`getSession({ fresh: true })`，避免跨 worker 旧 auth 缓存缺 `gender`。
3. `playersFromDirectory` / `ensureSelfInPlayers` / directory API 透传 `gender`。
4. Dedupe 同城同名时优先保留带显式 gender 的 twin。

**不**批量写生产库性别。

## Apply (prod)

Same host as ZQ-147 (`root@8.216.53.29`, `/opt/tennis-ai`).

```bash
# Prefer this surgical kit when 女单 already live:
bash deploy/ladder-gender-wins/scripts/apply-on-server.sh /opt/tennis-ai

# Or full 女单 kit (includes this fix):
bash deploy/ladder-womens-singles/scripts/apply-on-server.sh /opt/tennis-ai
```

Mac worker path (Keychain, used for ZQ-147):

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e ssh root@8.216.53.29 '...'
```

## Test

```bash
python3 -m unittest tests.test_ladder_womens_singles -v
```

## Four-surface

Web apply to `/opt/tennis-ai` (WebView-same). APK / IPA / 小程序无独立原生字符串 → 无需重签。
