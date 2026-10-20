# 演示视频去文字（涨球 · 四端）

分析拍摄页 / 正确动作的球星示范：**只显示可播画面**。技术下拉保留。

同步四端（见 Project `workflows/four-surface-release.md`）：

| Surface | URL |
| --- | --- |
| Web | https://yqchen.blog/tennis |
| Android | https://yqchen.blog/tennis-ai.apk |
| iOS | https://yqchen.blog/tennis-ai.ipa |
| WeChat | https://yqchen.blog/mp-weixin.zip |

## 去掉

- 「阿里娜·萨巴伦卡 · 正手上旋 · HD」署名
- 「进入哔哩哔哩，观看更高清 >」涨球侧入口
- 「打开B站原页」「换源 · YouTube」及同类源切换

片源仍用 HD 球星 embed（B站 `high_quality=1` 优先）。品牌 **涨球**；默认教练 **涨球教练**。

## 包内容

- `opt-patch/components/star-demo-player.tsx` — Next 干净播放器
- `opt-patch/apps/uniapp/...` — uni-app H5 / App / mp 组件 + embed 页
- `opt-patch/miniprogram/...` — 薄仓小程序 utils + embed 页
- `scripts/apply-on-server.sh` — 服务器：Next + uni-app + 剥离 APK/IPA JS + rebuild + mp zip
- `scripts/mac-four-surface-release.sh` — Mac：Keychain SSH 上传、apply、可选本地重打 APK/IPA/mp 并上传

## Mac 一键（推荐）

在 `yanqingMacBook Pro`：

```bash
# from tennis-ai checkout with this branch
bash deploy/demo-video-clean/scripts/mac-four-surface-release.sh

# or pass freshly built clients
LOCAL_APK=~/Desktop/tennis-ai.apk \
LOCAL_IPA=~/Desktop/tennis-ai.ipa \
LOCAL_MP_ZIP=~/Desktop/mp-weixin.zip \
  bash deploy/demo-video-clean/scripts/mac-four-surface-release.sh
```

服务器-only：

```bash
scp -r deploy/demo-video-clean root@8.216.53.29:/tmp/
ssh root@8.216.53.29 'bash /tmp/demo-video-clean/scripts/apply-on-server.sh /opt/tennis-ai'
```

## 证据

`media/demo-video-clean-20261020/`

- `reference-current-clutter.png` — 改前 clutter
- `01-clean-demo.png` / `02-clean-demo-desktop.png` — 干净预览
