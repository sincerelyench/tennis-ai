"use client";

import { useState } from "react";
import { coachRoster, type CoachId } from "@/lib/coach-roster";
import { useI18n } from "@/components/i18n-provider";
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
  // Fall back to text before first colon / Chinese colon.
  const cut = tip.split(/[:：]/)[0]?.trim();
  return cut || tip.slice(0, 4);
}

export function CoachProfileCard({ coachId }: { coachId: CoachId }) {
  const { t, locale } = useI18n();
  const zh = locale === "zh" || (typeof locale === "string" && locale.startsWith("zh"));
  const coach = coachRoster.find((item) => item.id === coachId);
  const [open, setOpen] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  if (!coach) return null;
  const lesson = coach.lessons.find((item) => item.strokeId === lessonId);
  return (
    <section
      className="space-y-1.5 rounded-md border border-border/70 bg-card/80 px-2.5 py-2"
      data-coach-profile={coach.id}
      data-coach-tips-compact="true"
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
      {/* Compact fixed technique chips — short labels only; tip text on select */}
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
      {lesson ? (
        <video
          src={lesson.clip}
          poster={lesson.poster}
          className="mt-1 aspect-video max-h-36 w-full rounded bg-zinc-900 object-contain"
          controls
          playsInline
          muted
          loop
          preload="metadata"
          data-coach-lesson={lesson.strokeId}
        />
      ) : null}
    </section>
  );
}
