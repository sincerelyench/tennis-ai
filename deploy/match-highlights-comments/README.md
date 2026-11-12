# 约球：精彩集锦 + 描述 + 评论（ZQ-100）

录入比分后，约球成功行可补充**精彩集锦**（上传视频或 URL）与**文字描述**；任意登录用户可评论。数据写入 Postgres `match_scores` / `match_scores_blob`（经现有 `userDbSave("scores")`）。

## 改动

- `lib/match-scores.ts`：`description` / `highlightUrl` / `comments[]`；参与者编辑集锦；登录用户评论 CRUD
- `POST/GET /api/friends/scores/[id]/highlight`：multipart 上传（`public/match-highlights/`，同教练库 80MB）或 JSON URL
- `GET/POST /api/friends/scores/[id]/comments`：列表 / 发表 / `{action:"delete"}`
- `components/friends-view.tsx`：仅**已录分**行展示集锦与评论；未录分行保持干净
- 中文文案 keys：`friends.highlight*` / `friends.comment*`

Web 为 APK / IPA / mp-weixin WebView 源，部署 Web 即四端生效。

## Apply

```bash
bash deploy/match-highlights-comments/scripts/apply-on-server.sh /opt/tennis-ai
```

Preview: https://yqchen.blog/match-highlights-comments.html
