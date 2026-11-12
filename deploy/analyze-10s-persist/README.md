# ZQ-81 · 分析 ≤~10s + 关页不中断

## What

1. **GPU `/tai`**: short clips (≤~10.5s, or `fast=1`) use real pose/score fast path — skip overlay encode, swing clip cut, and coach LLM (~2min). Multi-worker (`TAI_WORKERS`) kept.
2. **Coach 视频指导**: persist `job_id` in `localStorage` (`tennis-coach-active-job-v1`); unmount / soft nav does **not** abort upload or cancel the server job; remount resumes poll → guidance.
3. Analysis tab may stay hidden (`SHOW_ANALYSIS_TAB=false`); shared `/api/analyze` pipeline is fixed.

## Apply

```bash
export SSHPASS=...   # or Keychain voice-diary-prod-ssh
bash deploy/analyze-10s-persist/scripts/apply-gpu.sh
bash deploy/analyze-10s-persist/scripts/apply-web.sh
```

## Probe

```bash
# tiny / 10s clip should return analyze_mode=fast and e2e ≲ 10–15s when GPU idle
curl -F video=@clip10s.mp4 -F stroke=forehand -F fast=1 -F sample=0 \
  https://yqchen.blog/tai/api/analyze
```
