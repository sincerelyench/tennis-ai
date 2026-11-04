# correct-video-by-issues — 正确动作按问题点

产品：**涨球** / **涨球教练**。

分析报告的「正确动作」不再只播一条与问题无关的通用示范，而是根据本次分析指出的问题点（重心 / 击球点 / 动力链 / 击球效果及相关 findings）匹配示范视频。

## 行为

1. 从 `findings` + 四维低分检测最多 4 个问题点  
2. 每个问题点一张「正确动作 · {维度}」卡片  
3. 示范源：已选**已发布教练**且动作库有该技术 `videoUrl` → 教练片；否则球星高清片  
4. 加载 / 空 / 错误态齐全；错误时回退球星示范  

## 四端

| Surface | Delivery |
| --- | --- |
| Web | `opt-patch` → `/opt/tennis-ai`（`issue-correct-demos.ts` + `visual-coach.tsx` + i18n） |
| Android APK | inject + **1.0.100 / 200** 完整 `assembleRelease` 重签 |
| iOS IPA | www inject 刷新 |
| 微信小程序 | result 页正确动作卡片 + `mp-weixin.zip` |

## 部署

```bash
bash deploy/correct-video-by-issues/scripts/build-signed-apk.sh
bash deploy/correct-video-by-issues/scripts/mac-four-surface-release.sh
```

## 测试

```bash
python3 -m unittest tests.test_issue_correct_demos -v
```

## 证据

Project store: `media/correct-video-by-issues/`
