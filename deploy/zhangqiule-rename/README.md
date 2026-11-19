# ZQ-155 · 涨球 → 涨球乐（四端）

Product brand rename. AI coach stays **AI 教练**.

## Mac apply (after PR)

```bash
export SSHPASS="$(security find-generic-password -s voice-diary-prod-ssh -w)"
sshpass -e ssh root@8.216.53.29 'rm -rf /tmp/zhangqiule-rename'
sshpass -e scp -r deploy/zhangqiule-rename root@8.216.53.29:/tmp/zhangqiule-rename
sshpass -e ssh root@8.216.53.29 'bash /tmp/zhangqiule-rename/scripts/apply-on-server.sh /opt/tennis-ai'
```
