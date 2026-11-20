# ZQ-164 · cityReady 卡住导致排行榜/比赛结果全空

## Bug

燕青截图：城市已是 **无锡**、tab **单打**，仍显示「无锡 暂无球员 (0)」且顶栏一直 **「正在识别你的城市…」**；约球成功记录也空。  
**不是错库**：prod API `ladder?cityId=wuxi` ≈22、unscoped ≈27；`user-db-io ping` users/scores/intros 均有数据。

## Root cause

`friends-view.tsx`：

1. `cityReady` **初始 `false`**
2. `refreshLadder` / `refreshCityMatches` 在 `if (!cityReady) return` 门控下**根本不发请求**
3. `cityReady` 要等 `detectCityFromIp`（`/api/geo/city`）完成；客户端 fetch **无超时**；effect cleanup 可把 in-flight 标成 cancelled
4. `onPickCity` **不** `setCityReady(true)` → 手动选无锡也无法解锁拉榜

ZQ-163 空城市→无锡回退因此**从未跑到**。SSR 亦带 `data-city-detecting` + 空榜，水合若卡住或 geo 迟迟不返回，UI 永久 0。

## Fix

1. `cityReady` 初始改为 **`true`**（默认 `DEFAULT_CITY_ID`/wuxi 即可读库）
2. `detectCityFromIp` 客户端 fetch 加 **`AbortSignal.timeout(2500)`**（与 geo 路由一致）
3. 城市 init：`finally` 里务必 `setCityReady(true)`
4. `onPickCity` 调用 `setCityReady(true)`

不写库、不造用户。外科替换，不整文件覆盖。

## Apply

```bash
bash deploy/ladder-city-ready-unblock/scripts/apply-on-server.sh /opt/tennis-ai
```

## Verify

- HTML `/tennis/ladder`：**无**长期 `data-city-detecting`（首屏即可拉榜）
- Authed `?cityId=wuxi&format=singles` UI 有 ≈20+ 人
- 约球成功列表对有 replied intros 的账号非空

## ZQ-164b follow-up (auth-empty guard)

Prod retest after cityReady still reported empty for Yanqing, but:

- Process `DATABASE_URL` == disk `.env` → `tennis_ai`
- `user-db-io ping` users/scores/intros present
- Authed API `wuxi`≈21–22 / unscoped≈27; Yanqing session intros success=13
- Playwright with her `tennis_session` on current BUILD renders full Wuxi ladder + 约球列表

So DB was never empty. Misleading「暂无球员(0)」can appear when ladder APIs **401/fail** while the page shell still renders (soft-nav / stale cookie). Guard:

```bash
bash deploy/ladder-city-ready-unblock/scripts/apply-auth-empty-guard.sh /opt/tennis-ai
```

- Distinguish auth/fetch errors from true empty city
- Refetch on `visibilitychange` / `focus`
- `data-ladder-count` / `data-ladder-from-api` for support

Prod after 164b: `BUILD_ID=gD2PWLlQ9w51JattK6YK2`.
