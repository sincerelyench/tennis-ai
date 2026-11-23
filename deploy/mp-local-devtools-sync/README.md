# 小程序交付默认：本地微信开发者工具目录

**默认目标：** `/Users/yanqing/Downloads/mp-weixin (2)`（或 `$HOME/Downloads/mp-weixin (2)`）

云端 Linux 虚拟机**没有**你的 Mac 磁盘。只有下面两种方式能写进本机目录：

## A. 最快（本机一条命令，无需 Mac worker）

在 **Mac 终端**执行：

```bash
curl -fsSL https://yqchen.blog/mp-weixin.zip -o /tmp/mp-weixin.zip
mkdir -p "$HOME/Downloads/mp-weixin (2)"
TMP=$(mktemp -d) && unzip -qo /tmp/mp-weixin.zip -d "$TMP"
SRC="$TMP/mp-weixin"; [[ -d "$SRC" ]] || SRC="$TMP"
rsync -a --exclude 'project.private.config.json' --exclude '.zq-sync-backup-*' "$SRC"/ "$HOME/Downloads/mp-weixin (2)"/
echo DONE; ls "$HOME/Downloads/mp-weixin (2)/app.json"
```

或拉仓库后：

```bash
bash deploy/mp-local-devtools-sync/scripts/mac-pull-from-prod-zip.sh
```

然后微信开发者工具：**清缓存 → 编译**。

## B. 让云端代理能直接写 Mac（My Machines）

1. Mac 安装 CLI：`curl https://cursor.com/install -fsS | bash`
2. `agent login`
3. **保持运行：** `agent worker start`
4. 文档：https://cursor.com/docs/cloud-agent/self-hosted/my-machines  
5. worker 在线后，云端再跑 `bash deploy/mp-local-devtools-sync/scripts/sync-to-local-devtools.sh`
