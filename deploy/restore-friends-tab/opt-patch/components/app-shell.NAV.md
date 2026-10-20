# `components/app-shell.tsx` — player bottom nav

Replace the third player tab (`/coaches` / `coaches.nav`) with friends:

```ts
{ href: "/friends", key: "friends", labelKey: "nav.friends", icon: Users }
```

Full player set: `/analysis` · `/coach` · `/friends` · `/`（我的）.

Do not add `coaches.nav`（选教练）to the bottom bar. Coach selection lives in `coach-view.tsx` via `CoachSelectSection` / `PlayerCoachPicker`.
