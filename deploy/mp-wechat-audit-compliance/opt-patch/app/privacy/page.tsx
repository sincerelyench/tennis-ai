import Link from "next/link";

export const dynamic = "force-dynamic";

/** ZQ-168: public 隐私政策 — phone collection purpose / method / use */
export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg bg-white px-5 py-10 text-slate-900" data-legal="privacy">
      <h1 className="text-2xl font-extrabold">隐私政策</h1>
      <p className="mt-1 text-xs text-slate-400">更新日期：2026-11-23</p>
      <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
        <section>
          <h2 className="font-bold text-slate-900">1. 我们收集的信息</h2>
          <p>
            在您同意并主动登录后，可能收集：手机号码（验证码登录与账号安全）、用户名与密码（加密存储）、显示名与微信号（约球联络）、城市与水平、对局与约球记录。
          </p>
          <p>首页浏览功能介绍时，不索要手机号、头像或微信昵称授权。</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900">2. 使用目的、方式与用途</h2>
          <p>手机号：仅用于发送/校验登录验证码、账号识别与安全，不向无关第三方出售。</p>
          <p>资料与对局数据：用于约球匹配、排行榜、消息通知及您主动使用的教练功能。</p>
          <p>AI 对话：用于生成训练建议；页面显著标注「AI生成」。</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900">3. 存储与保护</h2>
          <p>
            信息存储于我们运营的服务器，采取访问控制与传输加密等合理措施。您可联系我们申请更正或注销相关信息。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900">4. 授权同意</h2>
          <p>
            仅在您勾选同意《用户服务协议》与《隐私政策》并主动登录后，才收集登录相关信息。拒绝授权仍可浏览介绍，但无法使用需登录的服务。
          </p>
        </section>
      </div>
      <Link className="mt-8 inline-block text-sm font-semibold text-teal-700 underline" href="/guest">
        返回功能介绍
      </Link>
    </main>
  );
}
