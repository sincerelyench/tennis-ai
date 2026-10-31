"use client";

import Link from "next/link";
import { pageClass } from "@/lib/data";
import { useI18n } from "@/components/i18n-provider";
import type { MatchShare } from "@/lib/match-share-store";
import { scoreBarLabel } from "@/lib/match-demo";

export function MatchShareView({ share }: { share: MatchShare | null }) {
  const { locale } = useI18n();
  const zh = locale !== "en";

  if (!share) {
    return (
      <div className={pageClass} data-page="match-share-missing">
        <h1 className="text-base font-bold text-foreground">{zh ? "分享不存在或已失效" : "Share not found"}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {zh ? "请向分享者重新要一条链接。" : "Ask the sharer for a fresh link."}
        </p>
        <Link href="/login" className="mt-4 text-xs text-primary">
          {zh ? "登录涨球" : "Sign in to 涨球"}
        </Link>
      </div>
    );
  }

  const m = share.match;
  const livePoints = m.points.filter((p) => !p.dead && p.rallyLength > 0);

  return (
    <div className={pageClass} data-page="match-share" data-share-id={share.id} data-zq-match-mvp="1">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {zh ? "访客可见 · 无需会员" : "Viewer · no membership"}
        </p>
        <h1 className="mt-1 text-base font-bold text-foreground">{m.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {share.ownerLabel} · {m.format === "doubles" ? (zh ? "双打" : "Doubles") : zh ? "单打" : "Singles"} ·{" "}
          {m.finalScore}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-section="share-stats">
        {[
          [zh ? "均速" : "Avg speed", zh ? `${m.stats.avgSpeedKmh} 公里/时` : `${m.stats.avgSpeedKmh} km/h`],
          [zh ? "回合" : "Rally", String(m.stats.avgRally)],
          [zh ? "制胜分" : "Winners", String(m.stats.winners)],
          [zh ? "非受迫" : "UFEs", String(m.stats.unforced)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{k}</p>
            <p className="text-sm font-semibold">{v}</p>
          </div>
        ))}
      </section>
      <p className="text-[11px] text-muted-foreground" data-speed-disclaimer="true">
        {m.speedDisclaimer}
      </p>

      <section className="space-y-2" data-section="share-points">
        <h2 className="text-sm font-semibold">
          {zh ? `全部回合 ${livePoints.length} 分（已剪空镜）` : `All rallies · ${livePoints.length} points (trimmed)`}
        </h2>
        <ul className="max-h-[min(60vh,520px)] space-y-1 overflow-auto" data-section="all-rallies">
          {livePoints.map((p, pi) => (
            <li key={p.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
              #{pi + 1} · {scoreBarLabel(p)} ·{" "}
              {zh
                ? ({
                    winner: "制胜分",
                    forced_error: "压迫失误",
                    unforced_error: "非受迫",
                    ace: "发球直接得分",
                    double_fault: "双误",
                  } as Record<string, string>)[p.result] || p.result
                : p.result}{" "}
              · {p.rallyLength}
              {zh ? "拍" : " shots"}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" data-section="share-coaching">
        <h2 className="text-sm font-semibold">{zh ? "涨球教练点评摘要" : "Zhangqiu Coach summary"}</h2>
        {m.coaching.slice(0, 3).map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-sm font-medium">{zh ? c.title : c.titleEn}</p>
            <p className="mt-1 text-xs text-muted-foreground">{zh ? c.body : c.bodyEn}</p>
          </div>
        ))}
      </section>

      {share.coachReviewOpen ? (
        <section className="rounded-lg border border-dashed border-border bg-card px-3 py-3" data-coach-review="open">
          <p className="text-sm font-medium text-foreground">{zh ? "教练复盘钩子已开" : "Coach review hook open"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {zh
              ? "涨球教练登录后可在学员/消息里对照这场分享写点评。访客无需会员即可看上面的统计与摘要。"
              : "Zhangqiu Coach can attach notes from students/inbox. Viewers see stats above without membership."}
          </p>
          <Link href="/login?next=/inbox" className="mt-2 inline-block text-xs text-primary">
            {zh ? "教练登录复盘" : "Coach sign-in to review"}
          </Link>
        </section>
      ) : null}

      <p className="text-[11px] text-muted-foreground">涨球 / 涨球教练</p>
    </div>
  );
}
