# 恢复球友 tab · 选教练放回教练页（2026-10-20）

## 问题

`coach-publish-select` 上线时把球员底栏第三项改成了「选教练」`/coaches`，挤掉了「球友」`/friends`。  
`/friends` 路由与内容仍在（UTR ladder + 列表，无搜索），只是底栏入口没了。

## 目标底栏（球员）

**分析 | 教练 | 球友 | 我的**

- 球友：本地 UTR 排行 + 球友列表（无「搜索球友/球场」、无 NTRP 标签）
- 选教练：放在 **教练** tab 内（`PlayerCoachPicker` / 已发布教练），**不是**底栏项
- 默认教练显示名：**涨球教练** / Zhangqiu Coach（不要掌球教练 / Poppy / 东东）
- 品牌：**涨球**

## 本包

| 路径 | 说明 |
| --- | --- |
| `apply-on-server.sh` | 在 `8.216.53.29:/opt/tennis-ai` 上改 AppShell + CoachView，build + restart |
| `opt-patch/` | 源码片段与导航约定 |
| `chunk-replacements.json` | 已构建 chunk 的保险替换 |
| `preview/index.html` | 本地可打开的 UI 预览（底栏含球友；教练页含选教练） |

## Mac / SSH 部署

```bash
scp -r deploy/restore-friends-tab root@8.216.53.29:/tmp/restore-friends-tab
ssh root@8.216.53.29 'bash /tmp/restore-friends-tab/apply-on-server.sh'
```

本云 VM 通常无 SSH 私钥；有密钥的 Mac worker 直接跑上述命令即可。

## 核对

登录球员后：

1. 底栏可见 **球友**，点开为 UTR ladder + 列表（无搜索框）
2. 底栏 **无**「选教练」；教练 tab 内可见选教练 / 涨球教练
3. `/tennis/coaches` 可保留为深链，但不应再占底栏
