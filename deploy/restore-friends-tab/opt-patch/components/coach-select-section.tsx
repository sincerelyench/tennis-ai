"use client";

/**
 * Embed published-coach picker inside the Coach tab (not bottom nav).
 * Default persona display: 涨球教练 / Zhangqiu Coach.
 */
import { PlayerCoachPicker } from "@/components/player-coach-picker";

type Locale = "zh" | "en";

type Props = {
  locale?: Locale;
  onSelect?: (coachId: string) => void;
  className?: string;
};

export function CoachSelectSection({
  locale = "zh",
  onSelect,
  className,
}: Props) {
  return (
    <section
      className={className}
      data-coach-select-published="true"
      aria-label={locale === "zh" ? "选教练" : "Choose coach"}
    >
      <PlayerCoachPicker
        locale={locale}
        onSelect={(coachId, _card) => {
          onSelect?.(coachId);
        }}
      />
    </section>
  );
}
