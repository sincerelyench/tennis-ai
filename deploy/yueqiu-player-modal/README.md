# 本地排行：点用户名弹窗看战绩（ZQ-78）

叠在 ZQ-75/77（`yueqiu-my-and-ladder`）之上。

## 改动

- **本地排行**点球员**用户名**打开 **Dialog 弹窗**（非整页、非内联面板）
- 弹窗展示该球员最近战绩（`GET /api/friends/player-matches`）
- 挑战按钮与其它行区域不打开战绩
- 文案精简；邀请/应战/录分门禁不变
- Web 为 APK / IPA / mp-weixin WebView 源，部署 Web 即四端生效

## Apply

```bash
bash deploy/yueqiu-player-modal/scripts/apply-on-server.sh /opt/tennis-ai
```

Preview: https://yqchen.blog/yueqiu-player-modal.html
