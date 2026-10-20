"use client";

import { useMemo, useState } from "react";
import {
  alternateSource,
  preferredEmbed,
  starDemoForStroke,
  type StarDemoSource,
} from "@/lib/star-demos";

type Locale = "zh" | "en";

type Props = {
  strokeId: string;
  locale?: Locale;
  /** Optional override from resolvePlatformDemo (coach video). */
  overrideEmbedUrl?: string;
  overrideCredit?: string;
  className?: string;
  /** Prefer Bilibili embed in CN (default true). */
  preferBilibili?: boolean;
};

function platformLabel(platform: string, locale: Locale): string {
  if (platform === "bilibili") return locale === "zh" ? "B站" : "Bilibili";
  if (platform === "youtube") return "YouTube";
  return platform;
}

/**
 * Correct form / 拍摄示例 player: star iframe by default (HD Bilibili preferred).
 * Never falls back to muddy /tennis/examples/*.mp4 coach clips.
 */
export function StarDemoPlayer({
  strokeId,
  locale = "zh",
  overrideEmbedUrl,
  overrideCredit,
  className,
  preferBilibili = true,
}: Props) {
  const demo = useMemo(() => starDemoForStroke(strokeId), [strokeId]);
  const initial = useMemo(
    () => preferredEmbed(demo, preferBilibili),
    [demo, preferBilibili],
  );
  const [src, setSrc] = useState<StarDemoSource>(initial);

  const credit =
    overrideCredit ||
    (locale === "zh"
      ? `${demo.nameZh} · ${demo.strokeLabelZh}`
      : `${demo.nameEn} · ${demo.strokeLabelEn}`);

  const embedUrl = overrideEmbedUrl || src.embedUrl;
  const alt = alternateSource(demo, src);

  return (
    <div className={className || "star-demo-player"}>
      <div className="star-demo-credit" data-star={demo.starKey} data-stroke={demo.strokeId}>
        {credit}
        {src.qualityHint ? (
          <span className="star-demo-quality"> · {src.qualityHint.toUpperCase()}</span>
        ) : null}
      </div>
      <div className="star-demo-frame" style={{ position: "relative", paddingTop: "56.25%" }}>
        <iframe
          title={credit}
          src={embedUrl}
          allow="fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            borderRadius: 8,
            background: "#0b1220",
          }}
        />
      </div>
      <div className="star-demo-actions" style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        <a href={overrideEmbedUrl ? overrideEmbedUrl : src.watchUrl} target="_blank" rel="noreferrer">
          {locale === "zh"
            ? `打开${platformLabel(src.platform, locale)}原页（高清）`
            : `Open original on ${platformLabel(src.platform, locale)} (HD)`}
        </a>
        {!overrideEmbedUrl && alt ? (
          <button
            type="button"
            onClick={() => setSrc(alt)}
            style={{ background: "none", border: "none", color: "#0d9488", cursor: "pointer", padding: 0 }}
          >
            {locale === "zh"
              ? `换源 · ${platformLabel(alt.platform, locale)}`
              : `Switch · ${platformLabel(alt.platform, locale)}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default StarDemoPlayer;
