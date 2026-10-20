/**
 * Merge these keys into lib/i18n/messages.ts (en + zh).
 * Avoid editing Poppy/东东 display strings here — sibling rename owns those.
 * Coach brand in this feature: 掌球教练 / Zhangqiu Coach.
 */

export const coachLibraryMessagesEn = {
  library: {
    nav: "Stroke library",
    title: "Stroke library / My demos",
    lead: "Upload teaching copy and a correct-motion demo for every stroke. Players and analysis use your materials when set.",
    empty: "Nothing saved for this stroke yet.",
    loading: "Loading stroke library…",
    error: "Could not load the stroke library.",
    retry: "Retry",
    prompt: "Teaching text / analysis prompt",
    promptPh: "How you teach this stroke…",
    demoTitle: "Demo title",
    video: "Demo video",
    upload: "Upload video",
    url: "Or paste a playable URL",
    save: "Save stroke",
    saving: "Saving…",
    saved: "Saved",
    clearVideo: "Clear video",
    coachName: "Zhangqiu Coach",
    fromCoach: "Zhangqiu Coach demo",
    platformFallback: "Platform demo",
  },
} as const;

export const coachLibraryMessagesZh = {
  library: {
    nav: "动作库",
    title: "动作库 / 我的示范",
    lead: "为每一项技术上传讲解文字与正确动作示范视频。学员与分析会优先使用你的材料。",
    empty: "这项技术还没有内容。",
    loading: "加载动作库…",
    error: "动作库加载失败。",
    retry: "重试",
    prompt: "讲解 / 分析提示",
    promptPh: "写出你教这项技术时的要点…",
    demoTitle: "示范标题",
    video: "示范视频",
    upload: "上传视频",
    url: "或粘贴可播放链接",
    save: "保存此项",
    saving: "保存中…",
    saved: "已保存",
    clearVideo: "清除视频",
    coachName: "掌球教练",
    fromCoach: "掌球教练示范",
    platformFallback: "平台示范",
  },
} as const;

/** Mobile nav item to add beside students / inbox for coach role. */
export const coachLibraryNavItem = {
  href: "/library",
  key: "library",
  labelKey: "library.nav",
} as const;
