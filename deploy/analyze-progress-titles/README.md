# 分析等待进度 · 步骤仅标题

用户反馈：等待 UI 步骤卡副文案太多。改为**只保留标题**（如 `1. 读取视频` / `2. 识别动作`），去掉「打开你的录像」「短片约 0.2 秒」等说明。保留头部（含「正在提交视频…」）与进度条；当前步仍用绿色边框。

## 包内容

| 路径 | 作用 |
| --- | --- |
| `opt-patch/components/analyze-progress.tsx` | Next 等待组件（titles-only） |
| `opt-patch/lib/job-progress.ts` | `PIPELINE_STEPS` 仅 name |
| `uniapp-patch/zq-analyze-progress.vue` | 小程序 / App 组件 |
| `preview/analyze-progress-preview.html` | 静态预览 |
| `gpu-patch/web/static/index.html` | `/tai` 静态五步 |
| `scripts/mac-four-surface-release.sh` | 四端发布 |

## 发布

```bash
bash deploy/analyze-progress-titles/scripts/mac-four-surface-release.sh
```

## 证据

截图写入 Agent Store：`media/analyze-progress-titles/`。
