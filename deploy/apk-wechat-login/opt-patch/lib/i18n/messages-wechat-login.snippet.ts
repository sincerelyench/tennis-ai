/**
 * Merge into lib/i18n/messages.ts under login: { ... } for en and zh.
 *
 * en.login:
 *   wechat: "Continue with WeChat",
 *   wechatSubmitting: "Signing in with WeChat…",
 *   wechatFail: "WeChat sign-in failed. Try again or use your phone number.",
 *   wechatWebHint: "WeChat sign-in works in the 涨球 app or mini program. On the website, use your phone number.",
 *   orPhone: "or use phone number",
 *
 * zh.login:
 *   wechat: "微信登录",
 *   wechatSubmitting: "正在微信登录…",
 *   wechatFail: "微信登录失败，请重试或改用手机号。",
 *   wechatWebHint: "微信登录请在涨球 App 或小程序中使用；网页端请用手机号登录。",
 *   orPhone: "或使用手机号登录",
 */
export const WECHAT_LOGIN_I18N = {
  en: {
    wechat: "Continue with WeChat",
    wechatSubmitting: "Signing in with WeChat…",
    wechatFail: "WeChat sign-in failed. Try again or use your phone number.",
    wechatWebHint:
      "WeChat sign-in works in the 涨球 app or mini program. On the website, use your phone number.",
    orPhone: "or use phone number",
  },
  zh: {
    wechat: "微信登录",
    wechatSubmitting: "正在微信登录…",
    wechatFail: "微信登录失败，请重试或改用手机号。",
    wechatWebHint: "微信登录请在涨球 App 或小程序中使用；网页端请用手机号登录。",
    orPhone: "或使用手机号登录",
  },
} as const;
