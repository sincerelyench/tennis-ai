"use client";

import { JourneyCurve } from "@/components/journey-curve";
import { useI18n } from "@/components/i18n-provider";
import type { JourneyShare } from "@/lib/journey-share-store";
import { cn } from "@/lib/utils";

export function JourneyShareCard({
  share,
  compact = false,
}: {
  share: Pick<JourneyShare, "name" | "strokeLabel" | "firstScore" | "latestScore" | "delta" | "nodes">;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const delta = share.delta;
  const deltaText = delta == null ? "—" : delta > 0 ? `+${delta}` : String(delta);
  const curvePoints = (share.nodes || [])
    .filter((node) => typeof node.score === "number")
    .map((node) => ({
      id: node.reportId,
      date: node.when,
      rating: node.score as number,
      kind: "match" as const,
    }));

  return (
    <article
      data-share-card="true"
      className={cn("overflow-hidden rounded-2xl border border-border bg-card", compact ? "" : "shadow-sm")}
    >
      <header className="bg-gradient-to-br from-primary to-primary-hover px-5 py-5 text-primary-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
          {t("brand")} · {t("journey.title")}
        </p>
        <h1 className="mt-1 text-xl font-bold">{share.strokeLabel}</h1>
        <p className="mt-1 text-xs opacity-90">{share.name}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-primary-foreground/10 p-3 text-center">
          <div>
            <p className="text-lg font-bold">{share.firstScore ?? "—"}</p>
            <p className="text-[11px] opacity-80">{t("journey.first")}</p>
          </div>
          <div className="border-x border-primary-foreground/20">
            <p className="text-lg font-bold">{share.latestScore ?? "—"}</p>
            <p className="text-[11px] opacity-80">{t("journey.now")}</p>
          </div>
          <div>
            <p className="text-lg font-bold">{deltaText}</p>
            <p className="text-[11px] opacity-80">{t("journey.change")}</p>
          </div>
        </div>
      </header>
      {!compact ? (
        <div className="border-b border-border px-4 py-3">
          <JourneyCurve points={curvePoints} embedded />
        </div>
      ) : null}
      <ol className="space-y-0 divide-y divide-border">
        {share.nodes.map((node, index) => (
          <li key={`${node.reportId}-${index}`} className="px-5 py-4" data-share-node={node.reportId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {node.when}
                  {node.sample ? ` · ${t("common.sample")}` : ""}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {node.score ?? "—"} · {node.grade || "—"}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                #{index + 1}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground">{node.gained}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("journey.still")}: {node.still}
            </p>
            {node.notes.length ? (
              <div className="mt-3 space-y-2">
                {node.notes.map((note) => (
                  <div key={note.id} className="rounded-md bg-muted px-3 py-2" data-coach-note={note.id}>
                    <p className="text-[11px] font-semibold text-primary">
                      {note.author} · {note.kind === "drill" ? t("common.drill") : t("coachNote.title")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-foreground">{note.text}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </article>
  );
}
