# Tiny-clip timeout fix

Short uploads timed out (UI `分析服务超时`) mostly from client **499** while GPU was busy or the page refreshed mid-upload—not because the clip was large.

## Live fixes
- Next: check `health.busy` before upload; map early AbortError → `error.uploadAborted`; beforeunload while analyzing
- GPU: HTTP middleware returns 409 busy before multipart parse; `CURSOR_AGENT_TIMEOUT_MS=60000`

## Proof
Job `fde742cb3a68` (3s tiny) submitted in 0.49s and completed; second POST got 409 busy in ~1.5s.
