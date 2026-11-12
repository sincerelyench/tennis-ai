# Rename demo user 小朱 → 小猪 (ZQ-92)

Canonical test/demo keepers (display names only):

- **陈燕青**
- **小猪** (`u_pig`; was briefly shown as 小朱 after ZQ-90)
- **Ivy**
- **Shirley**

This kit:

1. Renames `u_pig` display name `小朱` → `小猪` in Postgres auth
2. Rewrites keeper scores/intros name fields the same way
3. Patches `BANNED_DISPLAY_NAMES` so **小猪** is allowed and **小朱** is blocked (prevents the wrong label from returning)
4. Rebuilds Next + restarts `tennis-ai`

## Apply on production

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w 2>/dev/null || tr -d '\n' < ~/.ssh/voice-diary-prod)"
sshpass -e scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -r \
  deploy/rename-xiaozhu-to-xiaozhu root@8.216.53.29:/tmp/
sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@8.216.53.29 \
  'bash /tmp/rename-xiaozhu-to-xiaozhu/scripts/apply-on-server.sh /opt/tennis-ai'
```

## Verify

```bash
sudo -u postgres psql -d tennis_ai -Atc \
  "SELECT phone, display_name FROM users WHERE coalesce(display_name,'') <> '' ORDER BY display_name;"
# expect: Ivy, Shirley, 小猪, 陈燕青

curl -sS 'http://127.0.0.1:43127/tennis/api/friends/ladder?cityId=wuxi' | head
```

APK / IPA / mp-weixin WebViews load live web; no client rebuild required for this display-name fix.
