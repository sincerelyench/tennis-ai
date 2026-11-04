/**
 * Merge into lib/i18n/messages.ts (en + zh).
 * Keys for the analyze waiting UI. Step cards: titles only (no blurb/ETA).
 * Default coach: 涨球教练 / Zhangqiu Coach.
 */
export const analyzeProgressMessages = {
  en: {
    progress: {
      roadmapAria: "Analysis steps",
      currentStep: "Current step",
      leaveHint:
        "Closing this page will not stop the job. Come back anytime to check progress.",
      submittingClip: "Submitting video…",
      steps: {
        read: { name: "Read video" },
        pose: { name: "Pose" },
        swings: { name: "Find swings" },
        build: { name: "Organize" },
        coach: { name: "Coach notes" },
      },
    },
  },
  zh: {
    progress: {
      roadmapAria: "分析步骤",
      currentStep: "当前步骤",
      leaveHint: "关掉页面也不会中断，回来可继续查看进度。",
      submittingClip: "正在提交视频…",
      steps: {
        read: { name: "读取视频" },
        pose: { name: "识别动作" },
        swings: { name: "找出挥拍" },
        build: { name: "整理数据" },
        coach: { name: "教练点评" },
      },
    },
  },
} as const;
