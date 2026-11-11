"use client";

import { useState } from "react";
import { coachRoster, type CoachId } from "@/lib/coach-roster";
import { tipVideoLocale, videosForSkill } from "@/lib/coach";
import { useI18n } from "@/components/i18n-provider";
import { TipVideoStack } from "@/components/coach-tip-video";
import { cn } from "@/lib/utils";

export function CoachPicker({
  value,
  onChange,
}: {
  value: CoachId;
  onChange: (id: CoachId) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-2" data-coach-select="true">
      <p className="text-xs font-semibold text-foreground">{t("coach.pickTitle")}</p>
      <div className="flex flex-wrap gap-2">
        {coachRoster.map((coach) => {
          const selected = coach.id === value;
          return (
            <button
              key={coach.id}
              type="button"
              data-coach-id={coach.id}
              data-coach-selected={selected ? "true" : undefined}
              onClick={() => onChange(coach.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left",
                selected ? "border-primary bg-primary-subtle" : "border-border bg-card",
              )}
            >
              <p className="text-sm font-semibold text-foreground">
                {t(coach.nameKey)} · {t(coach.shortKey)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-primary">
                {selected ? t("coach.selected") : t("coach.select")}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function shortLessonLabel(strokeId: string, tip: string, zh: boolean) {
  if (strokeId === "fh-topspin" || /正手|forehand/i.test(tip)) return zh ? "正手" : "FH";
  if (strokeId === "bh-topspin" || /反手|backhand/i.test(tip)) return zh ? "反手" : "BH";
  if (strokeId === "serve" || /发球|serve/i.test(tip)) return zh ? "发球" : "Serve";
  if (/截击|volley/i.test(tip)) return zh ? "截击" : "Volley";
  if (/切削|slice/i.test(tip)) return zh ? "切削" : "Slice";
  if (/高压|smash/i.test(tip)) return zh ? "高压" : "Smash";
  const cut = tip.split(/[:：]/)[0]?.trim();
  return cut || tip.slice(0, 4);
}

/**
 * Fixed technique tip chips for 涨球教练.
 * Selecting a stroke shows real Bilibili / Xiaohongshu / YouTube lessons —
 * never /tennis/examples demo mp4 fillers.
 */
export function CoachProfileCard({ coachId }: { coachId: CoachId }) {
  const { t, locale } = useI18n();
  const zh = tipVideoLocale(String(locale || "")) === "zh";
  const coach = coachRoster.find((item) => item.id === coachId);
  const [open, setOpen] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  if (!coach) return null;
  const tipVideos = lessonId ? videosForSkill(lessonId, zh ? "zh" : "en") : [];
  return (
    <section
      className="space-y-1.5 rounded-md border border-border/70 bg-card/80 px-2.5 py-2"
      data-coach-profile={coach.id}
      data-coach-tips-compact="true"
      data-coach-tips-real-platform="true"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-foreground">
          {t(coach.nameKey)} · {t(coach.shortKey)}
        </p>
        <button
          type="button"
          data-coach-more="true"
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 text-[10px] font-semibold text-primary"
        >
          {open ? t("coach.hide") : t("coach.more")}
        </button>
      </div>
      {open ? (
        <div className="space-y-1" data-coach-details="true">
          <p className="text-[10px] leading-4 text-muted-foreground">{t(coach.bioKey)}</p>
          {coach.highlightKeys.map((key) => (
            <p key={key} className="text-[10px] leading-4 text-foreground">
              · {t(key)}
            </p>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1" data-coach-lessons="true" data-coach-lessons-compact="true">
        {coach.lessons.map((item) => {
          const tip = t(item.titleKey);
          const label = shortLessonLabel(item.strokeId, tip, zh);
          const selected = lessonId === item.strokeId;
          return (
            <button
              key={item.strokeId}
              type="button"
              data-coach-lesson-pick={item.strokeId}
              title={tip}
              onClick={() => setLessonId((current) => (current === item.strokeId ? null : item.strokeId))}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium leading-4",
                selected ? "bg-primary text-primary-foreground" : "bg-muted/80 text-muted-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {lessonId ? (
        <p className="text-[10px] leading-4 text-muted-foreground" data-coach-lesson-tip={lessonId}>
          {t(coach.lessons.find((item) => item.strokeId === lessonId)?.titleKey || "")}
        </p>
      ) : null}
      {tipVideos.length ? (
        <div className="mt-1 space-y-2" data-coach-lesson={lessonId || undefined} data-coach-lesson-real="true">
          <TipVideoStack videos={tipVideos} zh={zh} t={t} />
        </div>
      ) : null}
    </section>
  );
}
