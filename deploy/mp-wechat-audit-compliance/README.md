# ZQ-168 · 微信小程序审核整改

对应审核意见：

1. **先浏览再登录** — 勿一进首页就索要手机号/头像/昵称  
2. **协议与隐私** — 收集手机号前展示《用户服务协议》《隐私政策》并取得同意  
3. **深度合成-AI问答** — 后台勾选类目；AI 页显著标注「AI生成 / 人工智能生成」

## 代码改动

| 面 | 内容 |
| --- | --- |
| MP | 首屏 `pages/home`；`pages/legal`；登录勾选同意；`web?guest=1` |
| H5 | 公开 `/guest` `/privacy` `/terms`；middleware 放行；`coach-view` AI 标识 |

## 人工（公众平台）

设置 → 基本设置 / 服务类目 → 增加 **深度合成 - AI问答**，再提审。

## Apply

```bash
bash deploy/mp-wechat-audit-compliance/scripts/apply-on-server.sh /opt/tennis-ai
```
