import Link from "next/link";

export const dynamic = "force-dynamic";

/** ZQ-168: public 用户服务协议 */
export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg bg-white px-5 py-10 text-slate-900" data-legal="terms">
      <h1 className="text-2xl font-extrabold">用户服务协议</h1>
      <p className="mt-1 text-xs text-slate-400">更新日期：2026-11-23</p>
      <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
        <section>
          <h2 className="font-bold text-slate-900">1. 服务说明</h2>
          <p>
            涨球乐提供约球匹配、城市排行榜、赛果记录，以及 AI 教练问答与真实网络教练留言等功能。您可先浏览介绍，再自行选择登录。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900">2. 账号与注册</h2>
          <p>
            可通过用户名密码注册/登录。请妥善保管账号。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900">3. AI 生成内容</h2>
          <p>
            AI 教练问答与点评由人工智能生成（标注「AI生成 / 人工智能生成」），仅供训练参考。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900">4. 协议变更</h2>
          <p>我们可能更新本协议并在产品内公示；继续使用视为知悉更新内容。</p>
        </section>
      </div>
      <Link className="mt-8 inline-block text-sm font-semibold text-teal-700 underline" href="/guest">
        返回功能介绍
      </Link>
    </main>
  );
}
