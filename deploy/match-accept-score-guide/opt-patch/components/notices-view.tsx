"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useReports } from "@/lib/report-store";
import { pageClass } from "@/lib/data";
import { PageBack } from "@/components/page-back";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { displayWhen } from "@/lib/analysis";
import { displayGrade } from "@/lib/i18n/translate";

type IntroStatus = "awaiting_accept" | "pending" | "replied" | "cancelled";

type MatchIntroRow = {
  id: string;
  kind: "match" | "challenge";
  status: IntroStatus;
  fromName: string;
  toName: string;
  body?: string;
  needsAccept?: boolean;
  iAmTarget?: boolean;
  iAmFrom?: boolean;
  awaitingOther?: boolean;
  canCancel?: boolean;
  matchSuccess?: boolean;
  acceptedUnread?: boolean;
  fromNotify?: boolean;
  acceptedAt?: string | null;
};

export function NoticesView() {
  const { t, locale } = useI18n();
  const reports = useReports();
  const ready = reports.find((item) => item.status === "done");
  const [intros, setIntros] = useState<MatchIntroRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshIntros = useCallback(async () => {
    try {
      const res = await fetch("/tennis/api/friends/intros", {
        credentials: "include",
        headers: { "Accept-Language": locale === "zh" ? "zh-CN" : "en" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        inbox?: MatchIntroRow[];
        mine?: MatchIntroRow[];
        pendingAccept?: MatchIntroRow[];
        acceptedNotify?: MatchIntroRow[];
      };
      const inbox = Array.isArray(data.inbox) ? data.inbox : [];
      const mine = Array.isArray(data.mine) ? data.mine : [];
      const acceptedNotify = Array.isArray(data.acceptedNotify) ? data.acceptedNotify : [];
      const byId = new Map<string, MatchIntroRow>();
      for (const row of [...acceptedNotify, ...inbox, ...mine]) {
        if (row.status !== "awaiting_accept" && row.status !== "pending") continue;
        byId.set(row.id, row);
      }
      setIntros(Array.from(byId.values()));
    } catch {
      /* ignore */
    }
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshIntros();
      if (cancelled) return;
      // 打开通知中心即确认「对方已应战」未读，清除铃铛红点
      try {
        await fetch("/tennis/api/friends/intros", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ackAllAccepted", locale }),
        });
        if (!cancelled) await refreshIntros();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshIntros, locale]);

  async function onIntroAction(id: string, action: "accept" | "decline" | "cancel") {
    setBusyId(id);
    try {
      await fetch("/tennis/api/friends/intros", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, locale }),
      });
      await refreshIntros();
    } catch {
      /* ignore */
    }
    setBusyId(null);
  }

  const analysisItem = ready
    ? {
        id: "n1",
        href: `/report/${ready.id}?from=analysis`,
        title: t("notices.ready"),
        detail: t("notices.readyDetail", {
          grade: displayGrade(locale, ready.grade || ready.rating) || "B",
          when: displayWhen(ready.when, locale),
        }),
      }
    : {
        id: "n1",
        href: "/analysis",
        title: t("notices.ready"),
        detail: t("notices.sampleReadyBody"),
      };

  const hasChallenge = intros.length > 0;

  return (
    <div className={pageClass} data-page="notices">
      <div>
        <PageBack fallback="/" label={t("common.back")} />
        <h1 className="text-base font-bold text-foreground">{t("notices.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("notices.lead")}</p>
      </div>

      {hasChallenge ? (
        <section className="space-y-2" data-notices-challenges="true">
          <h2 className="text-sm font-semibold text-foreground">{t("notices.challenges")}</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {intros.map((row, index) => {
              const incoming = Boolean(row.needsAccept || (row.status === "awaiting_accept" && row.iAmTarget));
              const waiting = Boolean(
                row.awaitingOther || (row.status === "awaiting_accept" && row.iAmFrom && !row.iAmTarget),
              );
              const accepted = !incoming && !waiting && row.status === "pending";
              const peerName = row.iAmFrom ? row.toName : row.fromName;
              const title = incoming
                ? t("notices.challengeIncomingTitle", { name: row.fromName })
                : waiting
                  ? t("notices.challengeWaitingTitle", { name: row.toName })
                  : t("notices.challengeAcceptedTitle", { name: peerName });
              const detail = incoming
                ? t("notices.challengeIncomingDetail", { name: row.fromName })
                : waiting
                  ? t("notices.challengeWaitingDetail", { name: row.toName })
                  : t("notices.challengeAcceptedDetail");
              return (
                <div
                  key={row.id}
                  data-notice-challenge={row.id}
                  data-notice-kind={row.kind}
                  data-notice-status={row.status}
                  data-notice-accepted={accepted ? "true" : undefined}
                  data-notice-unread={row.acceptedUnread || row.fromNotify ? "true" : undefined}
                  className={`space-y-2 px-4 py-3 ${index === intros.length - 1 ? "" : "border-b border-border"}`}
                >
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
                  {accepted ? (
                    <p className="text-xs leading-5 text-muted-foreground" data-notice-wechat="true">
                      {row.body || t("friends.matchIntroBody")}
                    </p>
                  ) : null}
                  {incoming ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-notice-decline={row.id}
                        disabled={busyId === row.id}
                        onClick={() => void onIntroAction(row.id, "decline")}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted-foreground"
                      >
                        {t("friends.matchChallengeDecline")}
                      </button>
                      <button
                        type="button"
                        data-notice-accept={row.id}
                        disabled={busyId === row.id}
                        onClick={() => void onIntroAction(row.id, "accept")}
                        className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      >
                        {t("friends.matchChallengeAccept")}
                      </button>
                    </div>
                  ) : accepted ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/friends#score-entry"
                        data-notice-enter-score={row.id}
                        className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      >
                        {t("notices.enterScore")}
                      </Link>
                      <Link
                        href="/friends"
                        data-notice-open-friends={row.id}
                        className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                      >
                        {t("notices.openFriends")}
                      </Link>
                      {row.canCancel !== false ? (
                        <button
                          type="button"
                          data-notice-cancel={row.id}
                          disabled={busyId === row.id}
                          onClick={() => void onIntroAction(row.id, "cancel")}
                          className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted-foreground"
                        >
                          {t("friends.matchIntroCancel")}
                        </button>
                      ) : null}
                    </div>
                  ) : waiting || row.canCancel !== false ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/friends"
                        data-notice-open-friends={row.id}
                        className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                      >
                        {t("notices.openFriends")}
                      </Link>
                      {row.canCancel !== false ? (
                        <button
                          type="button"
                          data-notice-cancel={row.id}
                          disabled={busyId === row.id}
                          onClick={() => void onIntroAction(row.id, "cancel")}
                          className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted-foreground"
                        >
                          {t("friends.matchIntroCancel")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-2" data-notices-analysis="true">
        <h2 className="text-sm font-semibold text-foreground">{t("notices.analysis")}</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Link
            href={analysisItem.href}
            data-notice={analysisItem.id}
            className="block px-4 py-3 hover:bg-muted"
          >
            <p className="text-sm font-medium text-foreground">{analysisItem.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{analysisItem.detail}</p>
          </Link>
        </div>
      </section>

      {!hasChallenge && !ready ? (
        <EmptyState title={t("notices.empty")} description={t("notices.emptyDesc")} />
      ) : null}
    </div>
  );
}
