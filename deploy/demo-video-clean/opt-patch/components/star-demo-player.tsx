"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  className?: string;
  /** Prefer Bilibili HD embed in CN (default true). Not exposed in UI. */
  preferBilibili?: boolean;
};

/**
 * 拍摄示例 / 正确动作：只展示可播球星画面（无署名、无源切换、无平台角标文案）。
 * 片源仍优先 B站 high_quality；费德勒等仅 YouTube 时用 nocookie embed。
 * Never falls back to muddy /tennis/examples/*.mp4 coach clips.
 */
export function StarDemoPlayer({
  strokeId,
  locale = "zh",
  overrideEmbedUrl,
  className,
  preferBilibili = true,
}: Props) {
  const demo = useMemo(() => starDemoForStroke(strokeId), [strokeId]);
  const preferred = useMemo(
    () => preferredEmbed(demo, preferBilibili),
    [demo, preferBilibili],
  );
  const [src, setSrc] = useState<StarDemoSource>(preferred);

  useEffect(() => {
    setSrc(preferred);
  }, [preferred, strokeId]);

  const embedUrl = overrideEmbedUrl || src.embedUrl;
  const aria =
    locale === "zh"
      ? `${demo.strokeLabelZh}示范`
      : `${demo.strokeLabelEn} demo`;

  return (
    <div
      className={className || "star-demo-player"}
      data-star={demo.starKey}
      data-stroke={demo.strokeId}
      data-platform={overrideEmbedUrl ? "override" : src.platform}
      data-clean-demo="1"
    >
      <div
        className="star-demo-frame"
        style={{
          position: "relative",
          paddingTop: "56.25%",
          overflow: "hidden",
          borderRadius: 8,
          background: "#0b1220",
        }}
      >
        <iframe
          title={aria}
          src={embedUrl}
          allow="fullscreen; encrypted-media; picture-in-picture; autoplay"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            background: "#0b1220",
          }}
        />
      </div>
    </div>
  );
}

export default StarDemoPlayer;
