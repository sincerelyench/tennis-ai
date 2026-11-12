# 约球成功：严格跟库（ZQ-111）

叠在线上 `/opt/tennis-ai` 的 `friends-view` / `match-intros` 之上。

## 产品规则

- 「约球成功」与数据库里**每条真实成功 intro** 一一对应（`acceptedAt` 或应战成功 `pending`）。
- **禁止**按对手折叠 / 演示去重丢掉仍存在于库中的记录（含 元孝/袁啸）。
- **未录分**：行内「录入比分」（表单折叠）。
- **已录分**：行内比分 / 胜者 / 时间，无「录入比分」。
- **不写生产库**；展示层修复。DB 行归属修复（如把 `u_111` 改写成真手机号）须 Yanqing 事先同意。

## 根因摘要

1. PR #101 的 `dedupeSuccessfulIntros` / UI `dedupeSuccessRecords` 按对手折叠，重匹会藏旧成功行。
2. 线上 `involved()` 在 intro 已有 phone 时禁止按显示名认领 → `u_111(陈燕青历史名)→袁啸` 对真号 `18662147197` 不可见。
3. trim / fix-db / 未授权 cleanup 曾清显示名或删 intro；双写 `match_intros` + `match_intros_blob` + 进程 cache 放大不一致感。

## 改动文件

| 文件 | 作用 |
|------|------|
| `opt-patch/lib/match-intros.ts` | 孤儿名认领 + wechat 联号；去掉对手去重；短 TTL cache |
| `opt-patch/components/friends-view.tsx` | 去掉前端折叠；`data-match-success-db-fidelity` |
| `scripts/apply-on-server.sh` | 只拷源码 + build + restart，**不写库** |
| `scripts/verify-yanqing-success.on-server.sh` | 只读：DB 成功行 vs API success |

## Apply（谨慎）

先确认 `systemctl is-active tennis-ai` 为 active，再：

```bash
bash deploy/yueqiu-db-fidelity/scripts/apply-on-server.sh /opt/tennis-ai
bash deploy/yueqiu-db-fidelity/scripts/verify-yanqing-success.on-server.sh
```
