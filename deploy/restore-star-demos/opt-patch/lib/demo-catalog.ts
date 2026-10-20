/**
 * Correct-form / reference-video catalog for 涨球.
 * Platform defaults = famous stars (HD Bilibili preferred).
 * Coach picks are appended only when a published coach library video exists —
 * never as the default first chip (no Poppy / unknown coach muddy clips).
 */

import {
  STAR_DEMOS,
  normalizeStrokeId,
  type StarDemoStrokeId,
} from "@/lib/star-demos";

export type DemoPlatform = "bilibili" | "youtube" | "douyin" | "xhs" | "inApp" | "coach";

export type DemoItem = {
  id: string;
  strokeId: StarDemoStrokeId;
  platform: DemoPlatform;
  title: string;
  credit: string;
  watchUrl: string;
  embedUrl: string;
  /** Star demos sort before coach / community. */
  kind: "star" | "coach" | "community";
  qualityHint?: string;
};

export function demoPlatformLabel(platform: DemoPlatform, locale: "zh" | "en" = "zh"): string {
  if (platform === "bilibili") return locale === "zh" ? "B站" : "Bilibili";
  if (platform === "youtube") return "YouTube";
  if (platform === "coach") return locale === "zh" ? "教练示范" : "Coach demo";
  if (platform === "inApp") return locale === "zh" ? "应用内" : "In-app";
  if (platform === "douyin") return locale === "zh" ? "抖音" : "Douyin";
  if (platform === "xhs") return locale === "zh" ? "小红书" : "Xiaohongshu";
  return platform;
}

export function demoSourceLabel(item: DemoItem, locale: "zh" | "en" = "zh"): string {
  return `${demoPlatformLabel(item.platform, locale)} · ${item.title}`;
}

function starItemsForStroke(strokeId: StarDemoStrokeId): DemoItem[] {
  const d = STAR_DEMOS[strokeId];
  const items: DemoItem[] = [];
  const push = (src: typeof d.primary, suffix: string) => {
    items.push({
      id: `${strokeId}-star-${src.platform}-${suffix}`,
      strokeId,
      platform: src.platform,
      title: localeTitle(d, src.platform),
      credit: `${d.nameEn} · ${d.strokeLabelEn}`,
      watchUrl: src.watchUrl,
      embedUrl: src.embedUrl,
      kind: "star",
      qualityHint: src.qualityHint,
    });
  };
  // Bilibili first when available (CN), then YouTube — never muddy in-app examples.
  if (d.primary.platform === "bilibili") {
    push(d.primary, "bili");
    if (d.secondary) push(d.secondary, "yt");
  } else {
    if (d.secondary?.platform === "bilibili") push(d.secondary, "bili");
    push(d.primary, d.primary.platform === "youtube" ? "yt" : "pri");
    if (d.secondary && d.secondary.platform !== "bilibili") push(d.secondary, "sec");
  }
  return items;
}

function localeTitle(
  d: (typeof STAR_DEMOS)[StarDemoStrokeId],
  platform: DemoPlatform,
): string {
  if (platform === "bilibili") return `${d.nameZh} · ${d.strokeLabelZh}`;
  return `${d.nameEn} · ${d.strokeLabelEn}`;
}

/**
 * Platform reference list for a stroke. Stars first.
 * Pass optional coach item to append (selected published coach only).
 */
export function demosForStroke(
  strokeId: string,
  coachDemo?: { title: string; credit: string; url: string } | null,
): DemoItem[] {
  const id = normalizeStrokeId(strokeId);
  const list = starItemsForStroke(id);
  if (coachDemo?.url?.trim() && !coachDemo.url.includes("/tennis/examples/")) {
    list.push({
      id: `${id}-coach`,
      strokeId: id,
      platform: "coach",
      title: coachDemo.title || coachDemo.credit || "涨球教练",
      credit: coachDemo.credit || "涨球教练",
      watchUrl: coachDemo.url.trim(),
      embedUrl: coachDemo.url.trim(),
      kind: "coach",
    });
  }
  return list;
}

/** Default correct-form item = first star (Bilibili preferred). */
export function defaultDemoForStroke(strokeId: string): DemoItem {
  return demosForStroke(strokeId)[0];
}
