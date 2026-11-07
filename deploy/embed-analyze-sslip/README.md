# Embed sslip analyze UI (ZQ-53)

Replace the 涨球 `/analysis` surface with an iframe of the live tennis analyze UI:

`https://tennis.47.93.203.28.sslip.io/`

Optional deep-link: `?job=<id>` (also honored on `/tennis/analysis?job=`).

## Apply on `8.216.53.29`

```bash
bash deploy/embed-analyze-sslip/scripts/apply-on-server.sh /opt/tennis-ai
```

This copies `opt-patch/` into `/opt/tennis-ai`, runs `npm run build`, and restarts `tennis-ai`.

## Surfaces

- Web: https://yqchen.blog/tennis/analysis (and `/analysis/new`)
- Android / iOS: WebView already loads `https://yqchen.blog/tennis` → inherits embed
- WeChat mini program: `pages/web` shell → inherits embed

`/analysis/match` is unchanged.
