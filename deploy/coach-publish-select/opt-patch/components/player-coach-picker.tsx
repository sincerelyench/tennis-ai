"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_EN,
  DEFAULT_COACH_NAME_ZH,
  writeSelectedCoachClient,
} from "@/lib/coach-publish";
import type { PublishedCoachCard } from "@/lib/coach-selection";

type Locale = "zh" | "en";

type Props = {
  locale?: Locale;
  onSelect?: (coachId: string, card: PublishedCoachCard) => void;
};

function copy(locale: Locale) {
  if (locale === "zh") {
    return {
      title: "选择教练",
      lead: "不同已发布教练代表不同风格。分析与教练页会使用你所选教练的讲解与示范。",
      brand: "涨球",
      empty: "暂无已发布教练。请等教练完成训练并发布后再来选择。",
      loading: "加载已发布教练…",
      error: "加载失败，请重试。",
      retry: "重试",
      selected: "当前选用",
      pick: "选用",
      strokes: "项技术",
      defaultHint: `默认人格：${DEFAULT_COACH_NAME_ZH}`,
    };
  }
  return {
    title: "Choose a coach",
    lead: "Each published coach is a different style. Analysis and the Coach tab use that coach’s prompts and demos.",
    brand: "涨球",
    empty: "No published coaches yet. Come back after a coach finishes training and publishes.",
    loading: "Loading published coaches…",
    error: "Could not load. Try again.",
    retry: "Retry",
    selected: "Selected",
    pick: "Select",
    strokes: "strokes",
    defaultHint: `Default persona: ${DEFAULT_COACH_NAME_EN}`,
  };
}

export function PlayerCoachPicker({ locale = "zh", onSelect }: Props) {
  const t = copy(locale);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [coaches, setCoaches] = useState<PublishedCoachCard[]>([]);
  const [selectedId, setSelectedId] = useState(DEFAULT_COACH_ID);
  const [errMsg, setErrMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setPhase("loading");
    setErrMsg("");
    try {
      const [listRes, selRes] = await Promise.all([
        fetch("/tennis/api/coaches?published=1", { credentials: "include" }),
        fetch("/tennis/api/player/coach", { credentials: "include" }),
      ]);
      let list: PublishedCoachCard[] = [];
      if (listRes.ok) {
        const data = await listRes.json();
        list = data.coaches || [];
      } else {
        // Local fallback from publish store
        const raw = window.localStorage.getItem("tennis-coach-publish-v1");
        if (raw) {
          const store = JSON.parse(raw) as Record<string, { status: string; coachId: string; displayName: string; styleTagline: string; publishedAt: string | null; libraryStrokeCount: number }>;
          list = Object.values(store)
            .filter((p) => p.status === "published")
            .map((p) => ({
              coachId: p.coachId,
              displayName: p.displayName || DEFAULT_COACH_NAME_ZH,
              styleTagline: p.styleTagline || "",
              publishedAt: p.publishedAt,
              libraryStrokeCount: p.libraryStrokeCount || 0,
            }));
        }
      }
      let sel = DEFAULT_COACH_ID;
      if (selRes.ok) {
        const data = await selRes.json();
        sel = data.coachId || DEFAULT_COACH_ID;
      } else {
        sel = window.localStorage.getItem("tennis-player-selected-coach-v1") || DEFAULT_COACH_ID;
      }
      setCoaches(list);
      setSelectedId(sel);
      setPhase("ready");
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pick(card: PublishedCoachCard) {
    setBusyId(card.coachId);
    try {
      const res = await fetch("/tennis/api/player/coach", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coachId: card.coachId }),
      });
      writeSelectedCoachClient(card.coachId);
      if (!res.ok && res.status !== 409) {
        /* still keep local selection */
      }
      setSelectedId(card.coachId);
      onSelect?.(card.coachId, card);
    } finally {
      setBusyId("");
    }
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4" data-coach-picker="loading">
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto w-full max-w-md space-y-2 px-4 py-4" data-coach-picker="error">
        <p className="text-sm text-destructive">{t.error}</p>
        {errMsg ? <p className="text-xs text-muted-foreground">{errMsg}</p> : null}
        <button
          type="button"
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => void load()}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4" data-coach-picker="true">
      <header className="space-y-1">
        <p className="text-xs font-semibold text-primary">{t.brand}</p>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="text-sm leading-5 text-muted-foreground">{t.lead}</p>
        <p className="text-xs text-muted-foreground">{t.defaultHint}</p>
      </header>

      {coaches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-empty="true">
          {t.empty}
        </p>
      ) : (
        <ul className="space-y-2" role="list">
          {coaches.map((c) => {
            const on = c.coachId === selectedId;
            return (
              <li
                key={c.coachId}
                data-coach-id={c.coachId}
                data-selected={on ? "1" : "0"}
                className={
                  "rounded-lg border p-3 " +
                  (on ? "border-primary bg-primary/5" : "border-border bg-card")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-bold" data-coach-name="true">
                      {c.displayName || DEFAULT_COACH_NAME_ZH}
                    </p>
                    {c.styleTagline ? (
                      <p className="text-sm text-muted-foreground">{c.styleTagline}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {c.libraryStrokeCount} {t.strokes}
                      {on ? ` · ${t.selected}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-action="select-coach"
                    disabled={on || busyId === c.coachId}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                    onClick={() => void pick(c)}
                  >
                    {on ? t.selected : t.pick}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PlayerCoachPicker;
