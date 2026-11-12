"use client";

/**
 * Compact coach header personas:
 * 「AI 教练」+ selectable 「真实网络教练」.
 * Empty network slot shows short 「无教练」— no style/default-persona/publish essays.
 * Never shows 掌球教练 / Poppy.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COACH_ID,
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
      myCoaches: "我的教练",
      ai: "AI 教练",
      // Short specialty under the name — not a long bio / level bar.
      aiSpecialty: "擅长正手、反手、发球",
      aiHint: "即时问答",
      aiOn: "对话中",
      network: "真实网络教练",
      networkSpecialtyFallback: "正手、反手等技术指导",
      networkHint: "留言指导",
      networkOn: "留言中",
      selectCoach: "选择",
      changeCoach: "更换",
      none: "无教练",
    };
  }
  return {
    myCoaches: "My coaches",
    ai: "AI Coach",
    aiSpecialty: "Forehand, backhand & serve",
    aiHint: "Instant Q&A",
    aiOn: "Chatting",
    network: "Network coach",
    networkSpecialtyFallback: "Forehand, backhand & stroke tips",
    networkHint: "Message board",
    networkOn: "Messaging",
    selectCoach: "Pick",
    changeCoach: "Change",
    none: "No coach",
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
        name: normalizeDisplayName(card.displayName) || t.network,
        kind: "network",
        styleTagline: card.styleTagline,
      });
    } else {
      setNetwork(null);
    }
  }, [locale, t.network]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const zhangqiu: ChatPersona = {
    id: DEFAULT_COACH_ID,
    name: t.ai,
    kind: "zhangqiu",
  };

  const networkSlot: ChatPersona = network || {
    id: "__pick_network__",
    name: t.network,
    kind: "network",
  };

  return (
    <section
      className={cn("space-y-1.5", className)}
      data-coach-chat-personas="true"
      data-coach-header-compact="true"
      data-coach-specialty-top="true"
      data-network-empty={network ? undefined : "true"}
    >
      <p className="text-xs font-semibold text-foreground" data-coach-my-coaches-title="true">
        {t.myCoaches}
      </p>
      <div className="flex gap-2" role="list" data-coach-persona-row="true">
        {[zhangqiu, networkSlot].map((p) => {
          const isPickSlot = p.id === "__pick_network__";
          const selected =
            !isPickSlot &&
            (value === p.id ||
              (p.kind === "zhangqiu" && (value === "poppy" || value === "zhangqiu" || !value)));
          const specialty =
            p.kind === "zhangqiu"
              ? t.aiSpecialty
              : isPickSlot
                ? ""
                : (p.styleTagline || "").trim() || t.networkSpecialtyFallback;
          return (
            <button
              key={p.id}
              type="button"
              role="listitem"
              data-coach-id={p.id}
              data-coach-kind={p.kind}
              data-coach-selected={selected ? "true" : undefined}
              data-coach-pick-slot={isPickSlot ? "true" : undefined}
              onClick={() => {
                if (isPickSlot) {
                  if (onOpenPicker) onOpenPicker();
                  else window.location.assign("/tennis/coaches");
                  return;
                }
                onChange(p.id, p);
              }}
              className={cn(
                "min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-left",
                selected ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <p className="truncate text-sm font-bold text-foreground" data-coach-name="true">
                {p.kind === "zhangqiu" ? t.ai : network ? p.name : t.network}
              </p>
              {specialty ? (
                <p
                  className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground"
                  data-coach-specialty="true"
                >
                  {specialty}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] font-medium text-primary" data-coach-status="true">
                {p.kind === "zhangqiu"
                  ? selected
                    ? t.aiOn
                    : t.aiHint
                  : isPickSlot
                    ? t.none
                    : selected
                      ? t.networkOn
                      : t.networkHint}
              </p>
            </button>
          );
        })}
      </div>
      {network ? (
        <div className="flex justify-end">
          <button
            type="button"
            data-action="open-coach-picker"
            className="text-[11px] font-semibold text-primary"
            onClick={() => {
              if (onOpenPicker) onOpenPicker();
              else window.location.assign("/tennis/coaches");
            }}
          >
            {t.changeCoach}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default CoachChatPersonas;
