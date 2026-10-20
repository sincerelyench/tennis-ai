# Coach nav patch (manual)

In the coach mobile tab list (live chunk uses `U=[{href:"/students",…},{href:"/inbox",…},{href:"/",…}]`), insert:

```ts
{ href: "/library", key: "library", labelKey: "library.nav", icon: /* Library / Film icon */ }
```

Route already provided: `app/library/page.tsx` → `/tennis/library`.

Deep-link redirects that bounce coaches away from `/analysis` should **allow** `/library`.

Do not rename Poppy/东东 strings in the same edit as the rename sibling — only ensure library UI uses **涨球教练**.
