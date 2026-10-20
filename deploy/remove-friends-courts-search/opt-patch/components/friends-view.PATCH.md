# `components/friends-view.tsx` (on `/opt/tennis-ai`)

Remove the search UX only. Keep ladder + friend list.

## Delete / stop using

- `useState` for the search query
- `<Input … placeholder={t("friends.searchPh")} aria-label={t("friends.searchAria")} />`
- Any `friends.filter(…)` driven by that query — render `friends` (or `$data.friends`) directly
- Empty-state copy that says “Try another name or court” / “换个名字或场地再试”

## Keep

- Title + `{n} friends · Wuxi area` / `位球友 · 无锡一带`
- Local ladder (singles/doubles) and `rateLadder`
- Friend rows (avatar, NTRP, place, stroke chips)
- Brand **涨球**; coach name elsewhere stays **掌球教练**

`apply-on-server.sh` performs the surgical edit when the file exists; this note is the human checklist.
