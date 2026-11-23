import Link from "next/link";

export const dynamic = "force-dynamic";

/** ZQ-168: public guest browse page for WeChat MP — no login required. */
export default function GuestBrowsePage() {
  return (
    <main
      className="mx-auto min-h-screen max-w-lg bg-slate-50 px-5 py-10 text-slate-900"
      data-guest-browse="true"
    >
      <p className="text-sm font-semibold text-teal-700">涨球乐 · 功能介绍</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">先体验，再登录</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        本页无需授权手机号、头像或昵称。浏览结束后，可在小程序内自行选择登录以使用约球、排行榜同步等完整功能。
      </p>

      <section className="mt-8 space-y-4">
        {[
          ["约球与挑战", "按水平匹配本地球友，发起约球与赛后交流。"],
          ["城市排行榜", "查看单打 / 女单排名与赛果变化。"],
          ["AI 教练问答", "训练疑问可向 AI 教练提问。"],
          ["真实网络教练", "登录后可向真人教练留言求指导。"],
        ].map(([title, desc]) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-bold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
          </article>
        ))}
      </section>

      <aside
        className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4"
        data-ai-generated-notice="true"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
          AI生成 · 人工智能生成
        </p>
        <p className="mt-2 text-sm leading-6 text-teal-900/80">
          「AI 教练」对话与点评由人工智能生成，仅供训练参考，不构成专业医疗或竞技承诺。
        </p>
      </aside>

      <div className="mt-8 flex flex-col gap-3 text-sm">
        <Link className="font-semibold text-teal-700 underline" href="/terms">
          《用户服务协议》
        </Link>
        <Link className="font-semibold text-teal-700 underline" href="/privacy">
          《隐私政策》
        </Link>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 font-semibold text-white"
          href="/login"
        >
          去登录 / 注册
        </Link>
      </div>
    </main>
  );
}
