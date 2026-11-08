# 约球：先选城市，锁显示名

## 变更

1. **城市在匹配前**：约球页顶部先选城市/所在地，再进入「匹配约球」。
2. **不轻易改名**：去掉「怎么称呼你」可编辑输入；显示名只读展示；匹配区突出「自评水平」。
3. 显示名仍可在「我的」等处修改（若产品已有入口）。

## 应用

```bash
bash deploy/match-city-before-name/scripts/apply-on-server.sh /opt/tennis-ai
```

## 预览

https://yqchen.blog/tennis/match-city-before-name.html  
https://yqchen.blog/match-city-before-name.html

## 四端

Web `/opt/tennis-ai` 为 APK / IPA / 微信小程序 WebView 源；壳未改包时与网页一致。
