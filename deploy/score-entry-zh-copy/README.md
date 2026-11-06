# 录入比分中文去英文（locale-only）

中文约球页「录入比分」此前有 11 个确认相关 i18n key 缺失，会回退英文；标签「球员 A/B」也含拉丁字母。本补丁补齐纯中文文案，并把 UTR 混写改为「等级分」。

## Apply

```bash
export SSHPASS='Hello2026'
bash deploy/score-entry-zh-copy/scripts/apply-on-server.sh
```

若无 `sshpass`，可用 paramiko/SFTP 上传 `opt-patch` 后：`sudo -u tennis bash -lc 'cd /opt/tennis-ai && npm run build' && systemctl restart tennis-ai`。

## Surfaces

共享 Next UI（WebView / web-view）；同步更新 `zq-friends-score-inject.js`。
