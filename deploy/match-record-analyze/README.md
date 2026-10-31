# 比赛录制 + 分析 MVP

产品：**涨球 / 涨球教练**

## 本切片已交付

1. 分析 tab 增加「比赛录制 / 分析」入口（挥拍技术分析不回归）
2. 剪空镜 + 高光筛选（技术 / 分结果 / 回合长度）— UI + 本地演示数据
3. 击球统计：速度、深度、精准、回合；热力；UI 注明球速 ±10%
4. 自动比分条叠加；单打 / 双打
5. 线审尽力 + 语音喊判（Web Speech）
6. 回放球轨迹开关
7. 赛后涨球教练点评（发球/接发/弱点/模式）可跳分
8. Ground Mode：竖屏球心导出演示
9. 分享链接（访客无需会员）+ 教练复盘钩子
10. **录制前/中摄像头架设引导**（高度、距离、角度、球网/底线、Ground Mode；中英；产品 UI 不出现第三方品牌名）

## 明确延后 / 诚实 stub

- 真 GPU 球轨 / 线审模型未接满：流水线标 `demo` / `local`
- 真机相机录制在无摄像头 CI 环境用演示分析

## 部署

```bash
bash deploy/match-record-analyze/scripts/mac-four-surface-release.sh
# 或仅服务端：
# scp -r deploy/match-record-analyze root@8.216.53.29:/tmp/match-record-analyze
# ssh ... 'bash /tmp/match-record-analyze/scripts/apply-on-server.sh'
```

APK：**1.0.86**，`gradle assembleRelease` + ZHANGQIU 重签（禁止 zip-inject）。

## 证据

`media/match-camera-setup-guide-20261101/`
