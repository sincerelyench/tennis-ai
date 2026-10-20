# 涨球：分析等待进度 UI（分步路线图）

参考网球测评 2.0 的**过程信息架构**（横滑五步、逐步 ETA、%、预览、可离开提示），改成 **涨球** 品牌呈现：

- 品牌：涨球（不是「网球测评 2.0」）
- 默认教练文案：涨球教练
- **无** NTRP / 水平选择器（开局只选技术动作）
- 接线真实 `/tai` 字段：`step` / `step_name` / `progress` / `eta_steps` / `eta_hint` / `preview_rev`
- **不**改动 stroke / `apiStroke` 透传（发球 pass-through 由姊妹任务维护）

## 本仓改动（GPU `/tai` + e1）

| 路径 | 说明 |
| --- | --- |
| `web/static/index.html` | `/tai` 等待页品牌化 + 去掉水平选择器；保留五步路线图 |
| `web/app.py` | 第 5 步 ETA 文案点名涨球教练 |
| `web/static/e1.js` + `e1.css` | e1 排队页展示五步 / % / 预览 / `eta_hint` |
| `i18n/*.json` | queue 步骤文案 |

## 线上 Next + uni-app 热补

```bash
# Mac → 8.216.53.29
scp -r deploy/analyze-progress-ui root@8.216.53.29:/tmp/analyze-progress-ui
ssh root@8.216.53.29 'bash /tmp/analyze-progress-ui/scripts/apply-on-server.sh'
```

脚本会把 `opt-patch/components/analyze-progress.tsx` 与 `lib/job-progress.ts` 拷进 `/opt/tennis-ai`，附 uni-app 组件草稿，然后 `npm run build` + `systemctl restart tennis-ai`。

分析页若未自动替换 JSX，按 `opt-patch/ANALYSIS_VIEW_PATCH.md` 手工挂上 `<AnalyzeProgress />`。

## GPU `/tai` 静态

在 `47.93.203.28` 拉取本分支后重启算法服务（或 `pull.sh`），使 `web/static/index.html` 生效。

## 预览

`preview/index.html` — 手机 + 桌面等待态。

## 证据

`/cursor/stores/bc-f98fd786-b5b4-41c4-9e5b-4a743d4f7816/media/analyze-progress-ui-20261020/`
