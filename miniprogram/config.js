module.exports = {
  appTitle: "涨球",
  // 开发者工具请勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
  apiBase: "https://yqchen.blog/tennis",
  /**
   * 微信公众平台 → 功能 → 订阅消息 → 我的模板 ID。
   * 占位勿提交真实密钥；Yanqing 在公众平台创建后填入，或只配服务端 WECHAT_MP_TMPL_*。
   * 见 deploy/wechat-subscribe-notify/WECHAT-CONSOLE-TEMPLATES.md
   */
  subscribeTemplates: {
    ladder: "REPLACE_TMPL_LADDER",
    // Yanqing「用户邀约通知」— 详见 deploy/wechat-subscribe-notify/WECHAT-CONSOLE-TEMPLATES.md
    invite: "y3dQG1ss-l3h_Ebe2fhWymaigXuuDYgvL_rvgeT7lg",
    invite_accepted: "REPLACE_TMPL_INVITE_ACCEPTED",
    score_confirm: "REPLACE_TMPL_SCORE_CONFIRM",
    message: "REPLACE_TMPL_MESSAGE",
  },
}
