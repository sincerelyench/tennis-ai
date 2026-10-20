# Stroke pass-fix (发球 → 正手)

## Root cause

Uni-app / Android analysis wizard overwrote `strokeId` to `fh-topspin` when
entering `view=video|filming|loading`. Multipart still posts `stroke` from
`apiStroke`, so 发球 became `fh-topspin` → live `/tai` allowlist collapsed it to
`forehand` → report looked like 正手.

Exact `stroke=serve` on `/tai` already produces 发球; the client rarely kept it.

## Contents

| path | purpose |
| --- | --- |
| `algo/stroke.py` | product-id `normalize_stroke` |
| `algo/*.py` | session / analyze / technique / coach / progress drop-ins |
| `algo/patch-app-normalize.py` | patch `web/app.py` allowlist → `normalize_stroke` |
| `uniapp-patch/README.md` | source + built-JS fix for route watcher |
| `scripts/apply-on-servers.sh` | SSH apply to GPU + optional APK upload |

## Apply (Mac with deploy keys)

```bash
APK_SRC=/path/to/tennis-ai-1.0.80-stroke-fix.apk \
  bash deploy/stroke-pass-fix/scripts/apply-on-servers.sh
```

APK artifact (content-patched www JS):  
`/cursor/stores/bc-f98fd786-b5b4-41c4-9e5b-4a743d4f7816/media/stroke-pass-fix-20261020/tennis-ai-1.0.80-stroke-fix.apk`

Target live URL: https://yqchen.blog/tennis-ai.apk

## Smoke

```bash
curl -F sample=1 -F stroke=serve -F title='发球·probe' https://yqchen.blog/tai/api/analyze
# → job.stroke_mode == serve
curl -F sample=1 -F stroke=fh-topspin -F refresh=1 https://yqchen.blog/tai/api/analyze
# after GPU patch → job.stroke_mode == fh-topspin (not forehand)
```
