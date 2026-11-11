"use client";

import type { ExampleVideo } from "@/lib/coach";

export function isDemoOrLocalSrc(src: string | undefined): boolean {
  if (!src) return false;
  return (
    /\.mp4($|\?)/i.test(src) ||
    src.startsWith("/tennis/") ||
    src.startsWith("/examples/") ||
    src.includes("/examples/") ||
    src.includes("/tennis/examples")
  );
}

/** Real Bilibili / YouTube iframe or Xiaohongshu openable link — never local demo mp4. */
export function VideoLessonCard({
  video,
  zh,
  t,
}: {
  video: ExampleVideo;
  zh: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const platform = video.platform || (zh ? "bilibili" : "youtube");
  const platformLabel =
    platform === "xiaohongshu"
      ? zh
        ? "小红书"
        : "Xiaohongshu"
      : platform === "bilibili"
        ? zh
          ? "B站"
          : "Bilibili"
        : "YouTube";
  const realUrl = video.url && !isDemoOrLocalSrc(video.url) ? video.url : "";
  const iframeSrc =
    video.embedUrl &&
    !isDemoOrLocalSrc(video.embedUrl) &&
    (platform === "youtube" || platform === "bilibili")
      ? video.embedUrl
      : "";
  const mode: "iframe" | "link" = iframeSrc ? "iframe" : "link";

  if (!realUrl && !iframeSrc) {
    return null;
  }

  return (
    <div
      className="overflow-hidden rounded border border-border/80 bg-background/80"
      data-coach-video-lesson="true"
      data-video-skill={String(video.skill)}
      data-video-platform={platform}
      data-video-embed={mode}
      data-video-real-url={realUrl || undefined}
      data-video-no-demo="true"
    >
      <div className="px-2 pt-1.5">
        <p className="text-[10px] font-semibold text-primary">
          {zh ? `视频讲解 · ${platformLabel}` : `Video lesson · ${platformLabel}`}
        </p>
        <p className="text-xs font-medium text-foreground">{video.title}</p>
        {video.channel ? <p className="text-[10px] text-muted-foreground">{video.channel}</p> : null}
      </div>
      {mode === "iframe" ? (
        <div className="mt-1 aspect-video bg-muted" data-video-iframe-wrap="true">
          <iframe
            title={video.title}
            src={iframeSrc}
            className="h-full w-full border-0"
            // Bilibili player needs a real referrer; "no-referrer" breaks many BV embeds.
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={realUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex aspect-video flex-col items-center justify-center gap-2 bg-muted px-4 text-center"
          data-video-open-platform={platform}
        >
          <span className="text-sm font-semibold text-primary">
            {zh ? `在${platformLabel}打开真实讲解` : `Open on ${platformLabel}`}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {platform === "xiaohongshu"
              ? zh
                ? "小红书暂不支持页内嵌入，点此打开原笔记/主页视频。"
                : "Open the real lesson on the platform."
              : zh
                ? "点此打开平台原片（非站内演示视频）。"
                : "Open the real lesson on the platform."}
          </span>
        </a>
      )}
      <div className="space-y-1 px-2 py-1.5 text-[10px]">
        {realUrl ? (
          <a
            className="font-semibold text-primary underline"
            href={realUrl}
            target="_blank"
            rel="noreferrer"
            data-video-open-link="true"
          >
            {zh
              ? mode === "iframe"
                ? `若无法播放，打开${platformLabel}原链接`
                : `打开${platformLabel}原链接`
              : t("coach.openChannel", { channel: video.channel || platformLabel })}
          </a>
        ) : null}
        {video.notes ? <p className="text-muted-foreground">{video.notes}</p> : null}
        {video.practiceTip ? (
          <p className="font-medium text-foreground" data-video-practice-tip="true">
            {zh ? "怎么练：" : "Practice: "}
            {video.practiceTip}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TipVideoStack({
  videos,
  zh,
  t,
}: {
  videos: ExampleVideo[];
  zh: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const real = videos.filter((v) => !isDemoOrLocalSrc(v.url) || (!!v.embedUrl && !isDemoOrLocalSrc(v.embedUrl)));
  if (!real.length) return null;
  return (
    <div className="space-y-2" data-coach-tip-video-stack="true">
      {real.map((video, idx) => (
        <VideoLessonCard key={`${video.platform || "yt"}-${video.url}-${idx}`} video={video} zh={zh} t={t} />
      ))}
    </div>
  );
}
