"use client";

/**
 * Coach tab personas: 涨球教练 (AI chat) + selected network coach (human messaging).
 * Keeps 选教练 entry. Never shows Poppy.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COACH_ID,
  DEFAULT_COACH_NAME_EN,
  DEFAULT_COACH_NAME_ZH,
  normalizeDisplayName,
  PLAYER_SELECTED_COACH_KEY,
} from "@/lib/coach-publish";

const FAKE_NETWORK_COACH_IDS = new Set(["lin_kai", "linkai", "chen_xiao"]);
const FAKE_NETWORK_NAMES = /^(林凯教练|林凯|Coach Lin Kai|陈晓)$/i;

function isRealNetworkCoach(card: { coachId?: string; displayName?: string } | null | undefined) {
  if (!card) return false;
  const id = String(card.coachId || "").trim().toLowerCase();
  if (!id || id === "poppy" || id === "zhangqiu") return false;
  if (FAKE_NETWORK_COACH_IDS.has(id)) return false;
  const name = String(card.displayName || "").trim();
  if (!name || FAKE_NETWORK_NAMES.test(name)) return false;
  return true;
}

export type ChatPersona = {
  id: string;
  name: string;
  kind: "zhangqiu" | "network";
  styleTagline?: string;
};

type Locale = "zh" | "en";

type Props = {
  locale?: Locale;
  value: string;
  onChange: (id: string, persona: ChatPersona) => void;
  onOpenPicker?: () => void;
  className?: string;
};

type PublishedCard = {
  coachId: string;
  displayName: string;
  styleTagline?: string;
};

function copy(locale: Locale) {
  if (locale === "zh") {
    return {
      pickTitle: "我的教练",
      zhangqiu: DEFAULT_COACH_NAME_ZH,
      zhangqiuHint: "AI 教练 · 即时问答",
      zhangqiuOn: "正在问答",
      networkHint: "真人教练 · 留言",
      networkOn: "留言中",
      selectCoach: "选教练",
      changeCoach: "更换网络教练",
      none: "还没选网络教练",
    };
  }
  return {
    pickTitle: "My coaches",
    zhangqiu: DEFAULT_COACH_NAME_EN,
    zhangqiuHint: "AI coach · Instant Q&A",
    zhangqiuOn: "Chatting",
    networkHint: "Human coach · Messages",
    networkOn: "Messaging",
    selectCoach: "Choose coach",
    changeCoach: "Change network coach",
    none: "No network coach yet",
  };
}

export function CoachChatPersonas({
  locale = "zh",
  value,
  onChange,
  onOpenPicker,
  className,
}: Props) {
  const t = copy(locale);
  const [network, setNetwork] = useState<ChatPersona | null>(null);

  const load = useCallback(async () => {
    let selectedId = "";
    try {
      selectedId = window.localStorage.getItem(PLAYER_SELECTED_COACH_KEY) || "";
    } catch {
      /* ignore */
    }

    let card: PublishedCard | null = null;
    try {
      const selRes = await fetch("/tennis/api/player/coach", { credentials: "include" });
      if (selRes.ok) {
        const data = await selRes.json();
        selectedId = data.coachId || selectedId;
        if (data.coach) {
          card = {
            coachId: data.coach.coachId,
            displayName: normalizeDisplayName(data.coach.displayName),
            styleTagline: data.coach.styleTagline || "",
          };
        }
      }
    } catch {
      /* local fallback */
    }

    if (!card && selectedId && selectedId !== DEFAULT_COACH_ID && selectedId !== "poppy") {
      try {
        const listRes = await fetch("/tennis/api/coaches?published=1", { credentials: "include" });
        if (listRes.ok) {
          const data = await listRes.json();
          const list = (data.coaches || []) as PublishedCard[];
          card = list.find((c) => c.coachId === selectedId) || null;
        }
      } catch {
        /* ignore */
      }
    }

    if (card && isRealNetworkCoach(card)) {
      setNetwork({
        id: card.coachId,
        name: normalizeDisplayName(card.displayName) || (locale === "zh" ? "网络教练" : "Network coach"),
        kind: "network",
        styleTagline: card.styleTagline,
      });
    } else {
      setNetwork(null);
    }
  }, [locale]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const zhangqiu: ChatPersona = {
    id: DEFAULT_COACH_ID,
    name: t.zhangqiu,
    kind: "zhangqiu",
  };

  const personas: ChatPersona[] = network ? [zhangqiu, network] : [zhangqiu];

  return (
    <section className={cn("space-y-2", className)} data-coach-chat-personas="true">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{t.pickTitle}</p>
        <button
          type="button"
          data-action="open-coach-picker"
          className="text-xs font-semibold text-primary"
          onClick={() => {
            if (onOpenPicker) onOpenPicker();
            else window.location.assign("/tennis/coaches");
          }}
        >
          {network ? t.changeCoach : t.selectCoach}
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="list">
        {personas.map((p) => {
          const selected = value === p.id || (p.kind === "zhangqiu" && (value === "poppy" || value === "zhangqiu" || !value));
          return (
            <button
              key={p.id}
              type="button"
              role="listitem"
              data-coach-id={p.id}
              data-coach-kind={p.kind}
              data-coach-selected={selected ? "true" : undefined}
              onClick={() => onChange(p.id, p)}
              className={cn(
                "min-w-[42%] flex-1 rounded-lg border px-3 py-2 text-left",
                selected ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <p className="truncate text-sm font-bold text-foreground" data-coach-name="true">
                {p.name}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-primary">
                {selected
                  ? p.kind === "zhangqiu"
                    ? t.zhangqiuOn
                    : t.networkOn
                  : p.kind === "zhangqiu"
                    ? t.zhangqiuHint
                    : t.networkHint}
              </p>
              {p.styleTagline ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.styleTagline}</p>
              ) : null}
            </button>
          );
        })}
      </div>

      {!network ? (
        <p className="text-xs text-muted-foreground" data-network-coach-empty="true">
          {t.none} ·{" "}
          <button type="button" className="font-semibold text-primary" data-action="open-coach-picker" onClick={() => (onOpenPicker ? onOpenPicker() : window.location.assign("/tennis/coaches"))}>
            {t.selectCoach}
          </button>
        </p>
      ) : null}
    </section>
  );
}

export default CoachChatPersonas;
