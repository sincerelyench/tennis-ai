# 教练页：先选教练 + 全中文改进计划

## Product

- **我的教练**下先选教练（涨球 AI + 网络教练），再进入「视频指导 / 改进计划」；选择对两者生效
- 网络教练登录后可对学员留言（收件箱 / 学员页 / 教练页面板）
- 改进计划界面中文不夹英文；去掉「当前任务」
- 固定八项要点框缩小（可展开）；自由目标（如提高球速）给实用建议并附视频讲解，不硬套八项模板
- 底部「分析」tab 保持隐藏

## Patch files

见 `opt-patch/`、`preview/`、`scripts/apply-on-server.sh`

## Apply

```bash
bash deploy/coach-pick-then-chinese/scripts/apply-on-server.sh /opt/tennis-ai
```

Live: https://yqchen.blog/tennis/coach  
Preview: https://yqchen.blog/coach-pick-then-chinese.html
