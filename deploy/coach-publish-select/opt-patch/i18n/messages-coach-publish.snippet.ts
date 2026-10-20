/**
 * Merge into lib/i18n/messages.ts (en + zh).
 * Default persona: 涨球教练 / Zhangqiu Coach — never Poppy / 东东.
 */

export const coachPublishMessagesEn = {
  publish: {
    nav: "Publish",
    title: "Publish & training",
    lead: "Send your stroke library for style training, then request publish so players can choose you.",
    status: "Status",
    submitTrain: "Submit for training",
    requestPublish: "Request publish",
    withdraw: "Withdraw",
    queued: "Training queued",
    training: "Training",
    ready: "Ready to publish",
    published: "Published",
    rejected: "Rejected",
    draft: "Draft",
    stubNote: "Training status is a stub until GPU train is wired.",
    coachName: "Zhangqiu Coach",
  },
  coaches: {
    nav: "Coaches",
    title: "Choose a coach",
    lead: "Published coaches only. Each coach is a different style.",
    empty: "No published coaches yet.",
    select: "Select",
    selected: "Selected",
    loading: "Loading…",
    error: "Could not load coaches.",
    retry: "Retry",
  },
} as const;

export const coachPublishMessagesZh = {
  publish: {
    nav: "发布",
    title: "发布与训练",
    lead: "把动作库送去按你的风格训练，完成后申请发布，球员即可选择。",
    status: "状态",
    submitTrain: "提交训练",
    requestPublish: "申请发布",
    withdraw: "撤回",
    queued: "训练排队中",
    training: "训练中",
    ready: "可申请发布",
    published: "已发布",
    rejected: "已驳回",
    draft: "草稿",
    stubNote: "训练状态为 stub，真实 GPU 训练可挂同一接口。",
    coachName: "涨球教练",
  },
  coaches: {
    nav: "选教练",
    title: "选择教练",
    lead: "仅显示已发布教练。不同教练代表不同风格。",
    empty: "暂无已发布教练。",
    select: "选用",
    selected: "当前选用",
    loading: "加载中…",
    error: "加载失败。",
    retry: "重试",
  },
} as const;

export const coachPublishNavItem = {
  href: "/library",
  key: "publish",
  labelKey: "publish.nav",
} as const;

export const playerCoachesNavItem = {
  href: "/coaches",
  key: "coaches",
  labelKey: "coaches.nav",
} as const;
