# Analyze trim / upload hotfix

## Root cause

After video-clip-duration (default/min 10s, max = full source), `lib/trim-file.ts` still rejected any remuxed clip with `duration > 20` ("Submit only 10 seconds"). Selecting a window longer than 20s (allowed in the trimmer) made **both** copy and transcode paths throw, so the UI failed with "no picture after convert" before `/tai` was called.

Large uploads that did get past trim often hit nginx **499** because `/tai` buffered the full body (`proxy_request_buffering on`) while the browser aborted at the old 180s `taiFetch` timeout.

## Fix

- `lib/trim-file.ts`: drop hard 20s cap; only reject keyframe overruns relative to the requested window; raise remux timeout to 120s
- `lib/tai.ts` + `components/analysis-view.tsx`: analyze fetch timeout 900s (match nginx)
- `yqchen-tai.conf`: `proxy_request_buffering off`, `client_body_timeout 900s`

## Apply (Mac)

```bash
bash deploy/analyze-trim-hotfix/scripts/apply-on-server.sh
```

Web / APK WebView / iOS shell / 小程序 web-view all load `yqchen.blog/tennis` — no native rebuild required for this hotfix.
