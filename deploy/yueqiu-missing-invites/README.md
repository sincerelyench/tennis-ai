# ZQ-125 · 我的约球缺少挑战/邀请

## 根因

生产库里有 `yuzuiyu → 陈燕青` 的 `awaiting_accept`（`mi-mwebxuf3-7a8cfb`）：

- `buddyId` = `18662147197`（无锡真号，排行挑战正确）
- `toPhone` = `13900000003`（上海同名 twin）

`createMatchIntro` 用 `resolveUserIdByName(显示名)` 绑 `toPhone`，同名时抢到了上海号。  
之后 `ownsIntroSide` 禁止「活跃同名号」互相认领对方 phone 行 → 真号会话看不到邀请。

## 修复

- `lib/match-intros.ts`：`resolveUserIdByName` 优先 `buddyId` + 同城；`ownsIntroSide` 认领 target `buddyId`；`acceptIntro` 纠正误绑 `toPhone`
- 可选一行 DB 重绑（`YUEQIU_REBIND_TWIN=1`），带 JSON/文本备份；不删邀请

## 部署

```bash
# 仅代码
bash deploy/yueqiu-missing-invites/scripts/apply-on-server.sh /opt/tennis-ai

# 代码 + 一行 twin 重绑
YUEQIU_REBIND_TWIN=1 bash deploy/yueqiu-missing-invites/scripts/apply-on-server.sh /opt/tennis-ai

bash deploy/yueqiu-missing-invites/scripts/verify-yanqing-inbox.on-server.sh /opt/tennis-ai
```
