# 去掉「分析预览」· four-surface

Removes the waiting-page **分析预览 / analysis preview** card from:

1. Web Next (`/tennis`) — `components/analyze-progress.tsx`
2. Android / iOS (uni-app H5 www inside APK/IPA)
3. WeChat mp-weixin
4. GPU `/tai` static (`web/static/index.html`, `e1.js`, i18n)

**Keeps:** analyze flow, five-step progress + % + ETA, report, star demos, coach selection, E1 GPU auth hotfix, report four-dim if already live.

Brand: **涨球** / **涨球教练**.

## Mac release

```bash
# On yanqing MacBook Pro (Keychain voice-diary-prod-ssh + sshpass):
bash deploy/remove-analyze-preview/scripts/mac-four-surface-release.sh
```

## Server-only (web)

```bash
scp -r deploy/remove-analyze-preview root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/remove-analyze-preview/scripts/apply-on-server.sh /opt/tennis-ai'
```

## GPU-only

```bash
bash deploy/remove-analyze-preview/scripts/apply-gpu.sh /root/workspace/tennis-ai
```

## Verify

- Waiting UI has no `分析预览` heading / `zq-ap-preview`
- Marker: `https://yqchen.blog/tennis/remove-analyze-preview.html` → `data-no-analyze-preview=1`
- APK / IPA / mp-weixin.zip Content-Length/mtime updated
