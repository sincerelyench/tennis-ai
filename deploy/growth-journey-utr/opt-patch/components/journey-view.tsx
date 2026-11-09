"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { JourneyCurve, type RatingCurvePoint } from "@/components/journey-curve";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { pageClass } from "@/lib/data";
import { useSessionRole } from "@/lib/session-role";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

type HistoryPoint = RatingCurvePoint & {
  ratingBefore?: number;
  format?: "singles" | "doubles";
  sets?: [number, number][];
};

type HistoryPayload = {
  ok?: boolean;
  error?: string;
  empty?: boolean;
  format?: "singles" | "doubles";
  seed?: number | null;
  current?: number | null;
  delta?: number;
  points?: HistoryPoint[];
  matchCount?: number;
};

function formatRating(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function formatSets(sets?: [number, number][]) {
  if (!sets?.length) return "";
  return sets.map(([a, b]) => `${a}-${b}`).join(" · ");
}

function formatDelta(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 10) / 10;
  const text = v.toFixed(1);
  return v > 0 ? `+${text}` : text;
}

export function JourneyView() {
  const session = useSessionRole();
  const { t } = useI18n();
  const [format, setFormat] = useState<"singles" | "doubles">("singles");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<HistoryPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/tennis/api/friends/rating-history?format=${format}`, {
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as HistoryPayload | null;
      if (!res.ok || !payload?.ok) {
        setError(payload?.error || t("journey.loadFail"));
        setData(null);
        return;
      }
      setData(payload);
    } catch {
      setError(t("journey.loadFail"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [format, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const points = data?.points || [];
  const matchPoints = points.filter((p) => p.kind === "match");

  return (
    <div className={pageClass} data-page="journey" data-journey-kind="utr" data-role={session.role}>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{t("journey.crumb")}</p>
        <h1 className="mt-1 text-base font-bold text-foreground">{t("journey.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("journey.lead")}</p>
      </div>

      <div className="flex flex-wrap gap-2" data-rating-format="true" role="tablist">
        {(
          [
            { id: "singles" as const, label: t("journey.formatSingles") },
            { id: "doubles" as const, label: t("journey.formatDoubles") },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-rating-format-btn={item.id}
            aria-selected={format === item.id}
            onClick={() => setFormat(item.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              format === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground" data-journey-loading="true">
          {t("common.loading")}
        </p>
      ) : null}

      {!loading && error ? (
        <EmptyState title={t("journey.loadFail")} description={error}>
          <Button type="button" size="sm" onClick={() => void load()} data-journey-retry="true">
            {t("common.retry")}
          </Button>
        </EmptyState>
      ) : null}

      {!loading && !error && data ? (
        <>
          <section
            className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-4"
            data-journey-summary="true"
          >
            <div>
              <p className="text-[11px] text-muted-foreground">{t("journey.first")}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground" data-journey-seed="true">
                {formatRating(data.seed)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("journey.now")}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground" data-journey-current="true">
                {formatRating(data.current)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("journey.change")}</p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold tabular-nums",
                  (data.delta || 0) > 0
                    ? "text-primary"
                    : (data.delta || 0) < 0
                      ? "text-destructive"
                      : "text-foreground",
                )}
                data-journey-delta="true"
              >
                {formatDelta(data.delta)}
              </p>
            </div>
          </section>

          <JourneyCurve points={points} />

          <section className="space-y-3" data-section="rating-history">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("journey.historyTitle")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("journey.historyLead")}</p>
            </div>

            {matchPoints.length === 0 ? (
              <EmptyState title={t("journey.emptyTitle")} description={t("journey.emptyDesc")}>
                <Link
                  href="/friends"
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  data-journey-go-friends="true"
                >
                  {t("journey.goFriends")}
                </Link>
              </EmptyState>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card" data-journey-match-list="true">
                {matchPoints
                  .slice()
                  .reverse()
                  .map((point, index) => (
                    <div
                      key={point.id}
                      data-journey-match-row={point.id}
                      data-journey-match-result={point.result || ""}
                      className={cn(
                        "flex items-start justify-between gap-3 px-4 py-3",
                        index === matchPoints.length - 1 ? "" : "border-b border-border",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          <span className="text-muted-foreground">{t("journey.vs")} </span>
                          {point.opponentName || "—"}
                        </p>
                        {point.sets?.length ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatSets(point.sets)}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "font-semibold",
                              point.result === "win"
                                ? "text-primary"
                                : point.result === "loss"
                                  ? "text-destructive"
                                  : "",
                            )}
                          >
                            {point.result === "win"
                              ? t("journey.resultWin")
                              : point.result === "loss"
                                ? t("journey.resultLoss")
                                : "—"}
                          </span>
                          {" · "}
                          {t("friends.utrLabel")} {formatRating(point.ratingBefore)} → {formatRating(point.rating)}
                          {" · "}
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              (point.delta || 0) > 0
                                ? "text-primary"
                                : (point.delta || 0) < 0
                                  ? "text-destructive"
                                  : "",
                            )}
                          >
                            {formatDelta(point.delta)}
                          </span>
                        </p>
                      </div>
                      <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{point.date}</p>
                    </div>
                  ))}
              </div>
            )}
          </section>

          <p className="text-[11px] leading-5 text-muted-foreground" data-journey-footnote="true">
            {t("journey.footnote")}
          </p>
        </>
      ) : null}
    </div>
  );
}
