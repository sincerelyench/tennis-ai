# ZQ-163 · 排行榜空城市回退（镜像现网 hotpatch）

## Bug

燕青排行榜 UI 显示 0 人，但同一 `tennis_ai` 库 API 仍返回 `count=27`（无锡约 21 / 上海 4 / 香港 1 / unknown 1）。不是错库。

根因：`friends-view.tsx` 的 `refreshLadder` 按 `cityId`（IP/geo、localStorage、或自选）过滤；落到无球员城市（如 `beijing`）时直接空态，不回退。

## Fix（与现网一致）

Prod 已 hotpatch + atomic rebuild（`BUILD_ID=TYkmlLDQzDJPdqlLUFLE5`）。本 kit **镜像**该逻辑：

1. 先按当前 `cityId` 拉榜。
2. 若为空且城市不是 `DEFAULT_CITY_ID`（`wuxi`）→ 再拉无锡；有人则 `setCityId` + `persistCityId(DEFAULT_CITY_ID)`。
3. 仍为空 → 再拉 **unscoped**（不带 `cityId`），避免 DB 有人时 UI 空白。
4. **不写库**；不造用户。

仅外科替换 `refreshLadder`，不整文件覆盖 `friends-view.tsx`（避免冲掉后续 ZQ-150 等热修）。

## Apply

```bash
bash deploy/ladder-empty-city-fallback/scripts/apply-on-server.sh /opt/tennis-ai
```

Prefer `scripts/atomic-next-rebuild.sh` after patch（本 apply 脚本会优先调用）。

若现网已是该 hotpatch，脚本见 `ZQ-163` marker 会跳过替换，仍可走 rebuild。

## Verify

```bash
# Authed probes (cookie required) — expect non-empty when DB has players
# GET /tennis/api/friends/ladder?format=singles            → count≈27
# GET /tennis/api/friends/ladder?cityId=wuxi&format=singles → count≈21
# UI: city=beijing (0) should soft-switch to wuxi and show rows
```

## Four-surface

H5 同源（网页 / APK / IPA / 小程序 web-view）。无独立原生改动。
