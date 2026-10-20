# 恢复球星高清示范（涨球）

平台默认 **拍摄示例 / 正确动作 / 参考视频** = 成名球星球星片（萨巴伦卡、德约、桑普拉斯、费德勒、小威），**B站优先、高清**。  
教练动作库视频 **仅当** 球员选用了已发布教练且该教练该技术有 `videoUrl` 时使用。  
默认教练显示名：**涨球教练** / Zhangqiu Coach（不要掌球 / Poppy / 东东）。

## 根因

线上 `filmingExamples` 指向 `/tennis/examples/*.mp4`：640×480 陌生教练糊片（红夹克、TOPPER 挡网、DIVX）。  
教练动作库文案还写「学员与分析会优先使用你的材料」，把平台默认挤成教练片。

## 本包

| 路径 | 作用 |
| --- | --- |
| `opt-patch/lib/star-demos.ts` | 8 项技术球星目录（B站 + YT） |
| `opt-patch/lib/platform-demo.ts` | 默认球星 / 选用教练才播教练片 |
| `opt-patch/lib/demo-catalog.ts` | Correct form tabs：球星在前 |
| `opt-patch/lib/coach-library-analysis-hook.ts` | 分析 hook 恢复上述规则 |
| `opt-patch/components/star-demo-player.tsx` | iframe 播放器（B站 high_quality） |
| `opt-patch/app/api/star-demos/route.ts` | `GET /tennis/api/star-demos` |
| `preview/index.html` | 本地证据预览 |
| `scripts/apply-on-server.sh` | 拷到 `/opt/tennis-ai` + 文案修补 |

仓库另附：`miniprogram/utils/star-demos.js`

## 目录（片源）

| 技术 | 球星 | B站 | YouTube |
| --- | --- | --- | --- |
| 正手上旋 | 萨巴伦卡 | BV1knqeB4EpG | BZEAu4L3WzQ |
| 反手上旋 | 德约 | BV1Gy4y1a7zj | 6WyMFz4ynl4 |
| 发球 | 桑普拉斯 | BV13t411K7Kw | L_FCXLtUgI8 (Full HD) |
| 高压 | 小威 | BV1gF411o7tU | fpxXcyjEUok |
| 截击/切削 | 费德勒 | （署名一致，仅 YouTube） | b2mHhUeeSvc / oOfUMrsXgjA / rykbKkywHLw / sXXM3I9E4E8 |

## 部署（Mac / 有 SSH）

```bash
scp -r deploy/restore-star-demos root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/restore-star-demos/scripts/apply-on-server.sh /opt/tennis-ai'
# 按 NAV_PATCH 接线 filming example + correct form，合并 i18n，然后：
ssh root@8.216.53.29 'cd /opt/tennis-ai && sudo -u tennis npm run build && systemctl restart tennis-ai'
```

本 Cloud VM **无** 生产 SSH 私钥；apply 留给 Mac。

## 预览

打开 `preview/index.html`，应见萨巴伦卡 / 德约等嵌入，而非陌生教练。
