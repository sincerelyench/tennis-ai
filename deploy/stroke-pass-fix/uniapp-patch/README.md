# Uni-app / Android analysis stroke preserve

## Bug
`pages/analysis/index` route watcher forced `strokeId = "fh-topspin"` on
`view=video|filming|loading`, so picking 发球 still posted `stroke=fh-topspin`
→ `/tai` collapsed to forehand → 正手 report.

## Source fix (preferred)
In `apps/uniapp/src/pages/analysis/index.vue` (or equivalent):
- On `loading` / `video` / `filming`: **do not** assign `strokeId = 'fh-topspin'`.
- Only set a default when `strokeId` is empty.

## Built asset replace (APK www)
Replace `assets/www/assets/pages-analysis-index.*.js` watcher:

Before:
```
"loading"===t?(...,s.value="fh-topspin",...)
..."video"!==t&&"filming"!==t||(a.value="wizard",s.value="fh-topspin")
```

After:
```
"loading"===t?(...,s.value=s.value||"fh-topspin",...)
..."video"!==t&&"filming"!==t||(a.value="wizard")
```
