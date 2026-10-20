Thin-repo WeChat shell patches (also mirrored into uni-app mp build via apply-web + rebuild).

- queue.js: poll 250ms
- upload.js + api.js: fast=1 when duration≤6; cached → result page
