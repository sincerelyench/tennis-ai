module.exports = {
  "appTitle": "涨球",
  "lang": {
    "zh": "中文",
    "en": "EN"
  },
  "home": {
    "lead": "拍一段挥拍，按引导上传，然后排队等分析。",
    "sub": "适合自己练球时回看动作。这里不承诺分数会变高。",
    "devNote": "当前是开发态模拟登录，正式微信登录以后再接入。",
    "login": "开发态登录",
    "loggingIn": "正在登录…",
    "continue": "查看拍摄引导",
    "codeLabel": "登录码（可留空）",
    "codePlaceholder": "留空会自动生成开发码",
    "loggedIn": "已登录",
    "localCode": "没有拿到微信登录码，已改用本地开发码。"
  },
  "guide": {
    "title": "拍摄引导",
    "intro": "勾选你已经做到的项。没勾完也可以上传，这次会记为引导未完成。",
    "incompleteHint": "未完成的引导会写进本次任务，方便以后查看。",
    "progress": "已勾选 {{done}}/{{total}}",
    "continue": "去上传",
    "items": [
      {
        "key": "side",
        "title": "侧面机位",
        "desc": "手机放在球员侧面，能看清挥拍方向。不要正对着人拍。"
      },
      {
        "key": "full_body",
        "title": "全身入镜",
        "desc": "头、身体和脚都留在画面里。"
      },
      {
        "key": "racket",
        "title": "球拍可见",
        "desc": "引拍、击球和随挥时，球拍尽量不要出画。"
      }
    ]
  },
  "upload": {
    "title": "上传挥拍",
    "intro": "选择一段视频或现在拍。一段 8 到 15 秒的挥拍就够用。",
    "guideDone": "拍摄引导已完成",
    "guideSkipped": "拍摄引导未完成，仍会上传并记下这个状态",
    "strokeLabel": "这一段主要是",
    "forehand": "正手",
    "backhand": "反手",
    "choose": "从相册选择",
    "record": "现在拍摄",
    "chosen": "已选择 {{name}}（{{size}}）",
    "none": "还没有选择视频",
    "submit": "上传并排队",
    "uploading": "正在上传…",
    "longClip": "这段比较长，排队后的分析会更慢。"
  },
  "queue": {
    "title": "排队中",
    "queued": "排队中",
    "running": "分析中",
    "done": "分析已结束",
    "error": "分析没有完成",
    "cancelled": "这次分析已取消",
    "unknown": "正在查询状态",
    "jobId": "任务编号 {{id}}",
    "polling": "正在向服务器查询进度。",
    "guideDone": "本次已完成拍摄引导。",
    "guideSkipped": "本次拍摄引导未完成，后续结果可以据此标注。",
    "doneHint": "详细的动作结果会在后续版本开放。这一页不展示分数。",
    "home": "返回首页",
    "retry": "重新上传",
    "serverDetail": "服务器说明"
  },
  "errors": {
    "auth_required": "请先登录后再上传",
    "auth_invalid": "登录已失效，请重新登录",
    "login_code_invalid": "登录码无效，请重试",
    "login_body_invalid": "登录请求无法识别",
    "guide_invalid": "拍摄引导数据无法识别",
    "guide_too_long": "拍摄引导数据过长",
    "bad_client": "无法识别客户端",
    "video_required": "请先选择或拍摄一段视频",
    "video_type": "请上传 mp4、mov 或 webm 视频",
    "video_too_small": "视频文件太小或已损坏",
    "video_too_large": "视频超过 400MB，请剪短后再上传",
    "busy": "正在分析其他录像，请稍后再试",
    "network": "网络异常，请检查网络和服务器地址后重试",
    "bad_response": "上传未完成，没有拿到任务编号",
    "server": "服务器繁忙，请稍后重试",
    "generic": "操作失败，请稍后重试",
    "i18n": "文案加载失败，请确认后端已启动"
  }
};
