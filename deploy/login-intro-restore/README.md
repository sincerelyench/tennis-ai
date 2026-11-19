# ZQ-159：登录页产品介绍 = 网页四卖点（涨球乐）

**Prod already applied** by Mac `bc-b415e8ef` (2026-11-20). This kit / PR is **repo catch-up** so GitHub matches live `/opt/tennis-ai` i18n. Do **not** re-apply over the hotpatch unless verifying drift (`FORCE_ZQ159_APPLY=1`).

## Live copy (mirrors served `onboard.*`)

- **标题**：欢迎来到涨球乐
- **导语**：多打球、约对手、看排名、找教练——让我们大家一起涨球。
1. **一起涨球** — 多打球、多比赛，在实战中打磨技术，大家一起涨球。
2. **约到水平相当的球友**
3. **赛后看排名变化**
4. **AI 教练与真实网络教练** — 日常训练有疑问，可获 AI 教练与真实网络教练指导。

## Scope

| Surface | This PR |
| --- | --- |
| Web `/tennis` kit | `deploy/login-intro-restore/` (+ zhangqiule messages sync) |
| Local MP `mp-weixin (2)` | **Out of scope** — intro polish already under ZQ-158 lock (Mac). Do not overwrite. |
| WeChat one-tap | Owned by [#153](https://github.com/sincerelyench/tennis-ai/pull/153) |

## Force apply (drift only)

```bash
FORCE_ZQ159_APPLY=1 bash deploy/login-intro-restore/scripts/apply-on-server.sh /opt/tennis-ai
```
