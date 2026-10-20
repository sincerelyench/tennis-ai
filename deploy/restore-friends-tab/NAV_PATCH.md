# Nav fix (player AppShell)

## Wrong (after coach-publish-select live apply)

```ts
const playerNav = [
  { href: "/analysis", key: "analysis", labelKey: "nav.analyze", icon: Video },
  { href: "/coach", key: "coach", labelKey: "nav.coach", icon: BotMessageSquare },
  { href: "/coaches", key: "coaches", labelKey: "coaches.nav", icon: GraduationCap }, // ❌ replaced 球友
  { href: "/", key: "profile", labelKey: "nav.me", icon: User },
];
```

## Correct

```ts
import { Video, BotMessageSquare, Users, User } from "lucide-react";

const playerNav = [
  { href: "/analysis", key: "analysis", labelKey: "nav.analyze", icon: Video },
  { href: "/coach", key: "coach", labelKey: "nav.coach", icon: BotMessageSquare },
  { href: "/friends", key: "friends", labelKey: "nav.friends", icon: Users },
  { href: "/", key: "profile", labelKey: "nav.me", icon: User },
];
```

i18n already has `nav.friends` → 球友 / Friends. Do **not** put `coaches.nav`（选教练）in the bottom bar.

## Coach tab

Render published-coach picker **inside** `components/coach-view.tsx` (or coach page), e.g.:

```tsx
import { PlayerCoachPicker } from "@/components/player-coach-picker";

// Near top of CoachView, after title — prefer replacing the legacy roster chips:
<PlayerCoachPicker
  locale={locale === "zh" ? "zh" : "en"}
  onSelect={(coachId) => {
    writeCoachId(coachId);
    // refresh chat / plan for the new coach
  }}
/>
```

Keep route `/coaches` optional as a deep link; default coach display name **涨球教练**.
