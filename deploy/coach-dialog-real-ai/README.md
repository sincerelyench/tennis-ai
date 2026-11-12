# coach-dialog-real-ai (ZQ-82)

对话指导 free-form Q&A must call a real server-side LLM (Harmonix ha2 → 豆包), not canned `planReady` / `tasksReady` banks.

## Root cause

ha2 `src/app/api/llm/chat/route.ts` hardcoded `doubao-seed-2-0-lite-260215`, which Ark reports as `InvalidEndpoint.ClosedEndpoint`. Env already has working `DOUBAO_LLM_MODEL=doubao-seed-2-0-pro-260215`. Failures fell through to `fallbackCoachResponse` → fixed Chinese copy.

## Patch

| Path | Change |
| --- | --- |
| `ha2-patch/.../llm/chat/route.ts` | Use `DOUBAO_LLM_MODEL` / pro fallback |
| `opt-patch/lib/coach.ts` | Freeform never substitutes plan banks; `replySource` |
| `opt-patch/app/api/coach/chat/route.ts` | Freeform → live LLM; soft error if model down; B站 tips |
| `opt-patch/lib/harmonix.ts` | Ship live client (SSE) |

## Apply

```bash
bash deploy/coach-dialog-real-ai/scripts/apply-on-server.sh /opt/tennis-ai
```

Does not touch `feature-flags` / analysis tab.
