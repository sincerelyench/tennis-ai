# 比赛录制 + 分析 MVP

产品：**涨球 / 涨球教练**

## 本切片已交付

1. 分析 tab 增加「比赛录制 / 分析」入口（挥拍技术分析不回归）
2. 剪空镜 + 高光筛选（技术 / 分结果 / 回合长度）— UI + 本地演示数据
3. 击球统计：每球球速（非仅均速）、深度、精准、回合；球速 ±10%
4. 落点标注「第 N 拍」；蓝/红轨迹为底线→对面底线**直线**击球路径（无任意曲线）；全绿球场（无热力色块）；图例蓝=你 / 红=对手
4b. 演示赛生成完整一盘并列出全部有效回合（不截断样本）
4c. 界面文案跟随应用语言，不中英混排
5. 自动比分条叠加；单打 / 双打
6. 线审尽力 + 语音喊判（Web Speech）
7. 回放球轨迹开关
8. 赛后涨球教练点评（发球/接发/弱点/模式）可跳分
9. Ground Mode：竖屏球心导出演示
10. 分享链接（访客无需会员）+ 教练复盘钩子

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

APK：**1.0.89**，`gradle assembleRelease` + ZHANGQIU 重签（禁止 zip-inject）。

## 证据

`media/straight-ball-trajectories-20261101/`
