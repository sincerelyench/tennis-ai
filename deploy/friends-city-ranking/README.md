# 球友：城市排行 + 去掉硬编码球友卡片

产品：**涨球**。

## 改动

1. **去掉**硬编码 UTR 球友卡片（陈晓等 + 场馆 + 技术标签）和全局「无锡一带」说明。
2. **城市范围**：默认按 IP 定位；可手动切换。中文 UI 仅中国城市；英文 UI 含全球城市。
3. **排行**仅显示所选城市球员（类 UTR）。
4. **保留**录入比分；**不恢复**搜索球友/球场。

## 部署

```bash
scp -r deploy/friends-city-ranking root@8.216.53.29:/tmp/friends-city-ranking
ssh root@8.216.53.29 'bash /tmp/friends-city-ranking/scripts/apply-on-server.sh'
# APK：合入 uniapp-www 后 Gradle assembleRelease（禁止 zip-inject），version 1.0.82
# IPA：更新 www 后 rebuild
# mp-weixin：刷新 zip + FRIENDS note
```

## 证据

`media/friends-city-ranking-20261101/`
