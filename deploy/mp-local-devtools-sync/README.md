# 小程序交付默认：本地微信开发者工具目录

**默认目标（燕青本机）：** `/Users/yanqing/Downloads/mp-weixin (2)`

不要只更新线上 zip 当作完成。`project/` 是与现网对齐的完整工程。

## 同步

在 Mac 上：

```bash
bash deploy/mp-local-devtools-sync/scripts/sync-to-local-devtools.sh
```

然后开发者工具：**清缓存 → 编译**。

云端无 Mac worker 时无法直写该路径；拉分支后在本机跑上述脚本即可。
