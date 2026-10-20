/**
 * Merge into lib/i18n/messages.ts (en + zh).
 * Keys for the richer analyze waiting UI. Default coach: 涨球教练 / Zhangqiu Coach.
 * Do not reintroduce NTRP level picker copy on the waiting screen.
 */
export const analyzeProgressMessages = {
  en: {
    progress: {
      roadmapAria: "Analysis steps",
      preview: "Preview",
      currentStep: "Current step",
      leaveHint:
        "Closing this page will not stop the job. Come back anytime to check progress.",
      steps: {
        read: { name: "Read video", blurb: "Open your clip", eta: "~15 sec" },
        pose: { name: "Pose", blurb: "See the swing motion", eta: "~3–6 min" },
        swings: { name: "Find swings", blurb: "Mark each hit", eta: "~30 sec" },
        build: { name: "Organize", blurb: "Prepare scoring basis", eta: "~1 min" },
        coach: {
          name: "Coach notes",
          blurb: "Zhangqiu Coach writes drills",
          eta: "~2 min, slowest",
        },
      },
    },
  },
  zh: {
    progress: {
      roadmapAria: "分析步骤",
      preview: "分析预览",
      currentStep: "当前步骤",
      leaveHint: "关掉页面也不会中断，回来可继续查看进度。",
      steps: {
        read: { name: "读取视频", blurb: "打开你的录像", eta: "约 15 秒" },
        pose: { name: "识别动作", blurb: "看清挥拍动作", eta: "约 3–6 分钟" },
        swings: { name: "找出挥拍", blurb: "标出每一次击球", eta: "约 30 秒" },
        build: { name: "整理数据", blurb: "整理评分依据", eta: "约 1 分钟" },
        coach: {
          name: "教练点评",
          blurb: "涨球教练生成练习建议",
          eta: "约 2 分钟，最慢",
        },
      },
    },
  },
} as const;
