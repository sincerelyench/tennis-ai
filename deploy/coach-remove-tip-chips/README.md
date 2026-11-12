# Remove coach tip chips (点选要点)

Removes the dialog block with「点选要点，讲解出现在输入框上方」and 正手/发球/反手 tip chips.
Keeps specialty blurbs under coach names from `coach-specialty-input-layout` (#103).

## Apply

```bash
export SSHPASS='…'
bash deploy/coach-remove-tip-chips/scripts/apply-web.sh
```

## Verify

- No「点选要点」copy; no tip lesson chips above input
- Specialty under AI / network names still present
