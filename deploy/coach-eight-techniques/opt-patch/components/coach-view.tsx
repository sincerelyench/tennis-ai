"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState } from "@/components/empty-state";
import {
  resolvePhase,
  type ChatMessage,
  type CoachPlan,
  type CoachResponse,
  type CoachTask,
} from "@/lib/coach";
import type { CoachDrill } from "@/lib/eight-techniques";
import { pageClass } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { CoachProfileCard } from "@/components/coach-picker";
import { DEFAULT_COACH_ID, writeCoachId, type CoachId } from "@/lib/coach-roster";
import { CoachSelectSection } from "@/components/coach-select-section";
import { CoachChatPersonas, type ChatPersona } from "@/components/coach-chat-personas";

type UiMessage = {
  id: string;
  role: "coach" | "user";
  text: string;
  plan?: CoachPlan | null;
  planKind?: "improve";
  tasks?: CoachTask[];
  drill?: CoachDrill | null;
};

type BoardMessage = {
  id: string;
  text: string;
  at: string;
  status: "pending";
};

type CoachTab = "improve" | "tasks";

const MSG_KEY = "tennis-network-coach-messages-v1";

function readActiveChatCoach(): string {
  if (typeof window === "undefined") return DEFAULT_COACH_ID;
  try {
    return window.localStorage.getItem("tennis-ai-coach-chat") || DEFAULT_COACH_ID;
  } catch {
    return DEFAULT_COACH_ID;
  }
}

function writeActiveChatCoach(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tennis-ai-coach-chat", id);
  } catch {
    /* ignore */
  }
}

function isAiCoach(id: string) {
  return !id || id === DEFAULT_COACH_ID || id === "poppy" || id === "zhangqiu";
}

function readBoard(coachId: string): BoardMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(window.localStorage.getItem(MSG_KEY) || "{}") as Record<string, BoardMessage[]>;
    return Array.isArray(all[coachId]) ? all[coachId] : [];
  } catch {
    return [];
  }
}

function writeBoard(coachId: string, list: BoardMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(window.localStorage.getItem(MSG_KEY) || "{}") as Record<string, BoardMessage[]>;
    all[coachId] = list.slice(-40);
    window.localStorage.setItem(MSG_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function CoachView() {
  const { t, locale } = useI18n();
  const seq = useRef(0);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmedImprove, setConfirmedImprove] = useState(false);
  const [improvePlan, setImprovePlan] = useState<CoachPlan | null>(null);
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<CoachTab>("improve");
  const [coachId, setCoachId] = useState<string>(readActiveChatCoach);
  const [activePersona, setActivePersona] = useState<ChatPersona | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [board, setBoard] = useState<BoardMessage[]>([]);

  const phase = resolvePhase(true, confirmedImprove);
  const zh = locale === "zh" || (typeof locale === "string" && locale.startsWith("zh"));
  const chattingBuiltIn = isAiCoach(coachId);

  function resetThread(nextId: string, persona?: ChatPersona | null) {
    setCoachId(nextId);
    writeActiveChatCoach(nextId);
    if (isAiCoach(nextId)) {
      writeCoachId(DEFAULT_COACH_ID as CoachId);
    }
    seq.current = 0;
    setMessages([]);
    setHistory([]);
    setDraft("");
    setError("");
    setConfirmedImprove(false);
    setImprovePlan(null);
    setTab("improve");
    setStarted(true);
    if (isAiCoach(nextId)) {
      setBoard([]);
      void askCoach([], { daily: true, improve: false }, nextId);
    } else {
      setBoard(readBoard(nextId));
    }
    if (persona) setActivePersona(persona);
  }

  function pickPersona(id: string, persona: ChatPersona) {
    setActivePersona(persona);
    resetThread(id, persona);
  }

  function nextId(prefix: string) {
    seq.current += 1;
    return `${prefix}-${seq.current}`;
  }

  async function askCoach(
    nextHistory: ChatMessage[],
    flags: { daily: boolean; improve: boolean },
    nextCoach = coachId,
  ) {
    if (!isAiCoach(nextCoach)) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/tennis/api/coach/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: nextHistory,
          confirmedDaily: flags.daily,
          confirmedImprove: flags.improve,
          coachId: DEFAULT_COACH_ID,
          locale,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (CoachResponse & { error?: string; coachName?: string })
        | null;
      if (!response.ok || !payload?.text) {
        setError(payload?.error && !/[\u4e00-\u9fff]/.test(payload.error) ? payload.error : t("coach.retry"));
        return;
      }
      if (payload.improvePlan) setImprovePlan(payload.improvePlan);
      const plan = payload.improvePlan || payload.dailyPlan || null;
      setHistory([...nextHistory, { role: "assistant", content: payload.text }]);
      setMessages((current) => [
        ...current,
        {
          id: nextId("c"),
          role: "coach",
          text: payload.text,
          plan,
          planKind: plan ? "improve" : undefined,
          tasks: payload.tasks,
          drill: payload.drill || null,
        },
      ]);
    } catch {
      setError(t("coach.network"));
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (started) return;
    setStarted(true);
    if (isAiCoach(coachId)) {
      void askCoach([], { daily: true, improve: false });
    } else {
      setBoard(readBoard(coachId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function send(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    setDraft("");
    const user: ChatMessage = { role: "user", content: value };
    const nextHistory = [...history, user];
    setMessages((current) => [...current, { id: nextId("u"), role: "user", text: value }]);
    void askCoach(nextHistory, { daily: true, improve: confirmedImprove });
  }

  function leaveMessage(text: string) {
    const value = text.trim();
    if (!value || isAiCoach(coachId)) return;
    setDraft("");
    const item: BoardMessage = {
      id: nextId("m"),
      text: value,
      at: new Date().toISOString(),
      status: "pending",
    };
    const next = [...board, item];
    setBoard(next);
    writeBoard(coachId, next);
  }

  function confirmCurrent() {
    if (phase !== "improve" || !chattingBuiltIn) return;
    setConfirmedImprove(true);
    setTab("tasks");
    const user: ChatMessage = { role: "user", content: t("coach.confirmImproveMsg") };
    const nextHistory = [...history, user];
    setMessages((current) => [...current, { id: nextId("u"), role: "user", text: user.content }]);
    void askCoach(nextHistory, { daily: true, improve: true });
  }

  const confirmLabel = chattingBuiltIn && phase === "improve" ? t("coach.confirmImprove") : "";
  const chips = chattingBuiltIn
    ? zh
      ? ["我想学正手上旋", "我想学反手上旋", "我想学发球", "我想学高压", t("coach.chipTwice"), t("coach.chipContact")]
      : ["Learn topspin forehand", "Learn backhand topspin", "Learn serve", "Learn smash", t("coach.chipTwice"), t("coach.chipContact")]
    : [];
  const taskItems = messages.flatMap((message) => message.tasks || []);
  const latestDrill = [...messages].reverse().find((m) => m.drill)?.drill || null;

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleString(zh ? "zh-CN" : "en-US", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  return (
    <div
      className={pageClass}
      data-network-coach-chat="true"
      data-coach-mode={chattingBuiltIn ? "ai-chat" : "human-message"}
    >
      <h1 className="text-base font-bold text-foreground">{zh ? "我的教练" : "My coaches"}</h1>
      <p className="text-xs text-muted-foreground">
        {zh
          ? "涨球教练是 AI 即时问答；网络教练是平台真人，用留言沟通。"
          : "Zhangqiu Coach is AI chat; network coaches are real people via messages."}
      </p>

      <CoachChatPersonas
        locale={zh ? "zh" : "en"}
        value={coachId}
        onChange={pickPersona}
        onOpenPicker={() => setShowPicker((v) => !v)}
      />

      {showPicker ? (
        <div className="rounded-lg border border-border bg-card p-2" data-coach-picker-panel="true">
          <CoachSelectSection
            locale={zh ? "zh" : "en"}
            onSelect={(id) => {
              setShowPicker(false);
              if (id && id !== DEFAULT_COACH_ID && id !== "poppy") {
                pickPersona(id, {
                  id,
                  name: zh ? "网络教练" : "Network coach",
                  kind: "network",
                });
              }
            }}
          />
        </div>
      ) : null}

      {chattingBuiltIn ? <CoachProfileCard coachId={DEFAULT_COACH_ID as CoachId} /> : null}

      {!chattingBuiltIn ? (
        <section
          className="rounded-lg border border-border bg-card px-3 py-3"
          data-coach-profile={coachId}
          data-coach-kind="network"
          data-coach-panel="human-intro"
        >
          <p className="text-sm font-semibold text-foreground">
            {activePersona?.name || (zh ? "网络教练" : "Network coach")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {zh
              ? "平台真人教练。请留言，教练会择时回复——不是即时 AI 问答。"
              : "Real platform coach. Leave a message — they reply later, not instant AI chat."}
          </p>
        </section>
      ) : null}

      {chattingBuiltIn ? (
        <>
          <div className="flex gap-2" data-coach-tabs="true" role="tablist" aria-label={t("coach.stepsAria")}>
            {(["improve", "tasks"] as CoachTab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                data-coach-tab={item}
                data-coach-tab-selected={tab === item ? "true" : undefined}
                onClick={() => setTab(item)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold",
                  tab === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {t(item === "improve" ? "coach.improve" : "coach.tasks")}
              </button>
            ))}
          </div>

          {tab === "improve" && messages.length === 0 && pending ? <LoadingState label={t("coach.building")} /> : null}
          {messages.length === 0 && error ? (
            <EmptyState title={t("coach.empty")} description={error}>
              <Button type="button" onClick={() => void askCoach([], { daily: true, improve: false })}>
                {t("common.retry")}
              </Button>
            </EmptyState>
          ) : null}

          {tab === "improve" ? (
            <div className="space-y-3" data-coach-panel="ai-chat">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground"
                        : "max-w-[85%] space-y-3 rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground"
                    }
                  >
                    <p>{message.text}</p>
                    {message.plan ? <PlanCard plan={message.plan} t={t} /> : null}
                    {message.drill ? <DrillCard drill={message.drill} zh={zh} /> : null}
                  </div>
                </div>
              ))}
              {pending && messages.length > 0 ? <LoadingState label={t("coach.reviewing")} /> : null}
              {latestDrill && !messages.some((m) => m.drill) ? <DrillCard drill={latestDrill} zh={zh} /> : null}
            </div>
          ) : (
            <div className="space-y-3" data-coach-panel="tasks">
              {taskItems.length ? (
                taskItems.map((task) => <TaskCard key={task.id} task={task} t={t} />)
              ) : (
                <EmptyState title={t("coach.tasksEmpty")} description={t("coach.tasksEmptyDesc")} />
              )}
              {pending && confirmedImprove ? <LoadingState label={t("coach.reviewing")} /> : null}
            </div>
          )}

          {tab === "improve" && confirmLabel ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={confirmCurrent} data-action="confirm-plan">
                {confirmLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => send(t("coach.changeImprove"))}
              >
                {t("coach.changeIt")}
              </Button>
            </div>
          ) : null}

          {tab === "improve" && chips.length ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <Button key={chip} type="button" variant="outline" size="sm" disabled={pending} onClick={() => send(chip)}>
                  {chip}
                </Button>
              ))}
            </div>
          ) : null}

          {improvePlan && tab === "improve" ? (
            <p className="text-xs text-muted-foreground">
              {confirmedImprove ? t("coach.improveConfirmed") : t("coach.improvePending")}
            </p>
          ) : null}

          <form
            className="space-y-2"
            data-coach-composer="ai"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError("");
                }}
                placeholder={zh ? "问问涨球教练…" : "Ask Zhangqiu Coach…"}
                aria-label={t("coach.askAria")}
                className="h-10 bg-background"
                disabled={pending}
              />
              <Button type="submit" className="h-10 px-4" disabled={pending}>
                {t("common.send")}
              </Button>
            </div>
            {error && messages.length > 0 ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          </form>
        </>
      ) : (
        <>
          <div className="space-y-3" data-coach-panel="human-board">
            {board.length === 0 ? (
              <EmptyState
                title={zh ? "还没有留言" : "No messages yet"}
                description={zh ? "写一条技术问题或训练反馈吧。" : "Leave a technique question or training note."}
              />
            ) : (
              board.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                  data-message-id={item.id}
                >
                  <p className="text-[11px] font-semibold text-muted-foreground">{formatTime(item.at)}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground">{item.text}</p>
                  <p className="mt-1 text-[11px] font-semibold text-primary">
                    {zh ? "已留言，等待教练回复" : "Sent — waiting for coach reply"}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            className="space-y-2"
            data-coach-composer="message"
            onSubmit={(event) => {
              event.preventDefault();
              leaveMessage(draft);
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={zh ? "给教练留言…" : "Leave a message…"}
              aria-label={zh ? "给教练留言" : "Leave a message"}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" className="h-10 px-4" disabled={!draft.trim()}>
              {zh ? "留言" : "Leave message"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  t,
}: {
  plan: CoachPlan;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2" data-plan="improve">
      <p className="text-xs font-semibold text-primary">{t("coach.improve")}</p>
      <p className="mt-1 font-semibold">{plan.title}</p>
      {plan.summary ? <p className="mt-1 text-xs text-muted-foreground">{plan.summary}</p> : null}
      {plan.items.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          {plan.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DrillCard({ drill, zh }: { drill: CoachDrill; zh: boolean }) {
  return (
    <div
      className="rounded-md border border-border bg-background px-3 py-2"
      data-coach-drill={drill.strokeId}
      data-drill-title={drill.title}
    >
      <p className="text-xs font-semibold text-primary">
        {zh ? "涨球教练 · 分步练习" : "Zhangqiu Coach · drill"}
      </p>
      <p className="mt-1 font-semibold">{drill.title}</p>
      {drill.summary ? <p className="mt-1 text-xs text-muted-foreground">{drill.summary}</p> : null}
      <ol className="mt-2 space-y-2 text-xs" data-drill-steps="true">
        {drill.steps.map((step) => (
          <li key={step.phase} data-drill-phase={step.phase}>
            <p className="font-semibold text-foreground">{step.phase}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {step.cues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TaskCard({
  task,
  t,
}: {
  task: CoachTask;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const video = task.video;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background" data-task={task.skill}>
      <div className="px-3 pt-2">
        <p className="font-semibold">{task.title}</p>
        {task.detail ? <p className="mt-1 text-xs text-muted-foreground">{task.detail}</p> : null}
      </div>
      <div className="mt-2 aspect-video bg-muted">
        <iframe
          title={video.title}
          src={video.embedUrl}
          className="h-full w-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="px-3 py-2 text-xs">
        <a className="font-semibold text-primary underline" href={video.url} target="_blank" rel="noreferrer">
          {t("coach.openChannel", { channel: video.channel })}
        </a>
        <p className="mt-1 text-muted-foreground">{video.notes}</p>
      </div>
    </div>
  );
}
