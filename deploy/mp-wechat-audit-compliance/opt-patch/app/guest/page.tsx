import Link from "next/link";

export const dynamic = "force-dynamic";

/** ZQ-174: guest browse — calm composition; AI labels only on coach tab. */
export default function GuestBrowsePage() {
  const features = [
    ["约球与挑战", "按水平匹配本地球友，轻松约上一场。"],
    ["城市排行榜", "看本地单打与女单排名，赛后分数有迹可循。"],
    ["AI 教练与网络教练", "登录后可提问或留言，训练疑问有人答。"],
  ] as const;

  return (
    <main
      className="mx-auto min-h-screen max-w-lg bg-gradient-to-b from-teal-50 via-teal-50/40 to-white px-5 pb-12 pt-10 text-slate-900"
      data-guest-browse="true"
    >
      <div className="mb-8 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tennis/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="size-11 rounded-full bg-white shadow-md shadow-teal-700/15"
        />
        <p className="text-2xl font-extrabold tracking-wide text-teal-700">涨球乐</p>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">先逛逛，再登录</h1>
      <p className="mt-3 max-w-md text-[15px] leading-7 text-slate-600">
        约球、看排名、找教练——先看功能介绍，需要时再自行登录。本页不索要手机号、头像或昵称。
      </p>

      <section className="mt-8 divide-y divide-slate-200/80 border-t border-teal-700/10">
        {features.map(([title, desc], index) => (
          <article key={title} className="flex gap-3 py-5">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
              {index + 1}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{desc}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-teal-600 text-base font-bold text-white shadow-lg shadow-teal-600/30"
          href="/login"
        >
          去登录 / 注册
        </Link>
        <div className="flex items-center justify-center gap-2 text-sm text-teal-700">
          <Link className="underline" href="/terms">
            《用户服务协议》
          </Link>
          <span className="text-slate-400">·</span>
          <Link className="underline" href="/privacy">
            《隐私政策》
          </Link>
        </div>
      </div>
    </main>
  );
}
