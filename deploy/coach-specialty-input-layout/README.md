# Coach specialty + chip-near-input layout (ZQ-95)

## Goal

1. Under「我的教练」, each coach (AI + network) shows a **short specialty** under their name at the top.
2. Tapping suggestion bubbles (e.g.「我想学正手上旋」) puts the text **in the input**, not as a chat bubble above the chips.
3. Tip lesson content sits **near the input** (below chips), not buried above the bubbles.
4. Do not reintroduce「掌球教练」or long AI bio / level bars. AI display name stays「AI 教练」.

## Files

| Path | Change |
| --- | --- |
| `opt-patch/components/coach-chat-personas.tsx` | 「我的教练」title + specialty under each name |
| `opt-patch/components/coach-view.tsx` | Chip → fill draft; tip card below chips |
| `opt-patch/components/coach-picker.tsx` | `compactNearInput` tip card (no duplicate AI name header) |

## Apply

```bash
export SSHPASS='…'  # Keychain voice-diary-prod-ssh
bash deploy/coach-specialty-input-layout/scripts/apply-web.sh
```

Or on server:

```bash
bash /tmp/coach-specialty-input-layout/scripts/apply-on-server.sh /opt/tennis-ai
```

## Verify

- https://yqchen.blog/tennis/coach — 对话指导
- Specialty under AI / network at top (`data-coach-specialty`)
- Chip fill → input (`data-coach-chip-draft-input`)
- Tip block below chips (`data-coach-tips-near-input`)
