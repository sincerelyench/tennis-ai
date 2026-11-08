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
import { CoachVideoUpload } from "@/components/coach-video-upload";
import type { GuidanceBundle } from "@/lib/coach-video-guidance";
import { PLAYER_SELECTED_COACH_KEY } from "@/lib/coach-publish";

type UiMessage = {
  id: string;
  role: "coach" | "user";
  text: string;
  plan?: CoachPlan | null;
  planKind?: "improve";
  tasks?: CoachTask[];
  drill?: CoachDrill | null;
  kind?: "video-guidance";
};

type BoardMessage = {
  id: string;
  text: string;
  at: string;
  status: "pending";
  kind?: "video-guidance";
  jobId?: string;
};

/** Top-level coach sub-tabs: video guidance + improvement plan. */
type MainTab = "video" | "plan";

const MSG_KEY = "tennis-network-coach-messages-v1";
const MAIN_TAB_KEY = "tennis-coach-main-tab-v1";

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

function readMainTab(): MainTab {
  if (typeof window === "undefined") return "video";
  try {
    const v = window.localStorage.getItem(MAIN_TAB_KEY);
    return v === "plan" ? "plan" : "video";
  } catch {
    return "video";
  }
}

function writeMainTab(tab: MainTab) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAIN_TAB_KEY, tab);
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
  const [mainTab, setMainTab] = useState<MainTab>(readMainTab);
  const [coachId, setCoachId] = useState<string>(readActiveChatCoach);
  const [activePersona, setActivePersona] = useState<ChatPersona | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [board, setBoard] = useState<BoardMessage[]>([]);

  const phase = resolvePhase(true, confirmedImprove);
  const zh = locale === "zh" || (typeof locale === "string" && locale.startsWith("zh"));
  const chattingBuiltIn = isAiCoach(coachId);

  const videoMessages = messages.filter((m) => m.kind === "video-guidance");
  const planMessages = messages.filter((m) => m.kind !== "video-guidance");
  const videoBoard = board.filter((m) => m.kind === "video-guidance");
  const networkBoardTarget =
    (!isAiCoach(coachId) ? coachId : "") ||
    (activePersona?.kind === "network" ? activePersona.id : "") ||
    "";

  function selectMainTab(tab: MainTab) {
    setMainTab(tab);
    writeMainTab(tab);
    // 改进计划始终走涨球教练；从网络教练切过来时补一次计划对话。
    if (tab === "plan" && planMessages.length === 0 && !pending) {
      if (!isAiCoach(coachId)) {
        setCoachId(DEFAULT_COACH_ID);
        writeActiveChatCoach(DEFAULT_COACH_ID);
        writeCoachId(DEFAULT_COACH_ID as CoachId);
      }
      void askCoach([], { daily: true, improve: false }, DEFAULT_COACH_ID);
    }
  }

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

  function leaveMessage(text: string, opts?: { kind?: "video-guidance"; jobId?: string; targetCoachId?: string }) {
    const value = text.trim();
    const target = opts?.targetCoachId || coachId;
    if (!value || isAiCoach(target)) return;
    if (!opts?.kind) setDraft("");
    const item: BoardMessage = {
      id: nextId("m"),
      text: value,
      at: new Date().toISOString(),
      status: "pending",
      kind: opts?.kind,
      jobId: opts?.jobId,
    };
    if (target === coachId) {
      const next = [...board, item];
      setBoard(next);
      writeBoard(target, next);
    } else {
      const existing = readBoard(target);
      writeBoard(target, [...existing, item]);
      if (mainTab === "video") {
        setBoard([...existing, item]);
      }
    }
  }

  function readSelectedNetworkCoachId(): string {
    if (typeof window === "undefined") return "";
    try {
      const id = window.localStorage.getItem(PLAYER_SELECTED_COACH_KEY) || "";
      if (!id || isAiCoach(id)) return "";
      return id;
    } catch {
      return "";
    }
  }

  function applyVideoGuidance(bundle: GuidanceBundle, meta: { jobId: string; strokeId: string; fileName: string }) {
    const userMsg: UiMessage = {
      id: nextId("u"),
      role: "user",
      text: bundle.userText,
      kind: "video-guidance",
    };
    const aiMsg: UiMessage = {
      id: nextId("c"),
      role: "coach",
      text: bundle.aiText,
      drill: bundle.drill,
      kind: "video-guidance",
    };
    setHistory((prev) => [
      ...prev,
      { role: "user", content: bundle.userText },
      { role: "assistant", content: bundle.aiText },
    ]);
    setMessages((current) => [...current, userMsg, aiMsg]);
    selectMainTab("video");

    const networkId =
      (!isAiCoach(coachId) ? coachId : "") ||
      (activePersona?.kind === "network" ? activePersona.id : "") ||
      readSelectedNetworkCoachId();
    if (networkId) {
      leaveMessage(bundle.networkText, {
        kind: "video-guidance",
        jobId: meta.jobId,
        targetCoachId: networkId,
      });
      // Refresh board view for that coach so the leave-message shows under 视频指导.
      setBoard(readBoard(networkId));
    }
  }

  function confirmCurrent() {
    if (phase !== "improve") return;
    setConfirmedImprove(true);
    selectMainTab("plan");
    const user: ChatMessage = { role: "user", content: t("coach.confirmImproveMsg") };
    const nextHistory = [...history, user];
    setMessages((current) => [...current, { id: nextId("u"), role: "user", text: user.content }]);
    void askCoach(nextHistory, { daily: true, improve: true });
  }

  const confirmLabel = phase === "improve" ? t("coach.confirmImprove") : "";
  const chips = zh
    ? ["我想学正手上旋", "我想学反手上旋", "我想学发球", "我想学高压", t("coach.chipTwice"), t("coach.chipContact")]
    : ["Learn topspin forehand", "Learn backhand topspin", "Learn serve", "Learn smash", t("coach.chipTwice"), t("coach.chipContact")];
  const taskItems = planMessages.flatMap((message) => message.tasks || []);
  const latestDrill = [...planMessages].reverse().find((m) => m.drill)?.drill || null;
  const videoDrill = [...videoMessages].reverse().find((m) => m.drill)?.drill || null;

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

  const mainTabs: { id: MainTab; label: string }[] = [
    { id: "video", label: t("coach.videoGuidance") || (zh ? "视频指导" : "Video guidance") },
    { id: "plan", label: t("coach.improve") },
  ];

  return (
    <div
      className={pageClass}
      data-network-coach-chat="true"
      data-coach-mode={chattingBuiltIn ? "ai-chat" : "human-message"}
      data-coach-main-tab={mainTab}
    >
      <h1 className="text-base font-bold text-foreground">{zh ? "我的教练" : "My coaches"}</h1>
      <p className="text-xs text-muted-foreground">
        {zh
          ? "视频指导上传挥拍求教；改进计划由涨球教练生成。涨球教练是 AI；网络教练是平台真人。"
          : "Upload swings for video guidance; improvement plans come from Zhangqiu Coach (AI). Network coaches are real people."}
      </p>

      <div
        className="flex gap-2"
        data-coach-main-tabs="true"
        role="tablist"
        aria-label={t("coach.mainTabsAria") || (zh ? "教练分区" : "Coach sections")}
      >
        {mainTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mainTab === item.id}
            data-coach-main-tab-btn={item.id}
            data-coach-main-tab-selected={mainTab === item.id ? "true" : undefined}
            onClick={() => selectMainTab(item.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold",
              mainTab === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mainTab === "video" ? (
        <section className="space-y-3" data-coach-panel="video-guidance" data-coach-main-panel="video">
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

          <CoachVideoUpload locale={zh ? "zh" : "en"} disabled={pending} onGuidance={applyVideoGuidance} />

          <div className="space-y-3" data-coach-video-results="true">
            {videoMessages.length === 0 && videoBoard.length === 0 ? (
              <EmptyState
                title={zh ? "还没有视频指导" : "No video guidance yet"}
                description={
                  zh
                    ? "上传约 10 秒侧面挥拍，涨球教练会即时点评，并同步留言给你选的网络教练。"
                    : "Upload ~10s side-view swing. Zhangqiu Coach replies in chat; the same clip is messaged to your network coach."
                }
              />
            ) : null}

            {videoMessages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground"
                      : "max-w-[85%] space-y-3 rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground"
                  }
                  data-message-kind="video-guidance"
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.role === "coach" ? (
                    <p className="text-[11px] font-semibold text-primary">
                      {zh ? "涨球教练 · 视频指导" : "Zhangqiu Coach · video guidance"}
                    </p>
                  ) : null}
                  {message.drill ? <DrillCard drill={message.drill} zh={zh} /> : null}
                </div>
              </div>
            ))}
            {videoDrill && !videoMessages.some((m) => m.drill) ? <DrillCard drill={videoDrill} zh={zh} /> : null}

            <div className="space-y-2" data-coach-panel="human-board" data-board-scope="video-guidance">
              <p className="text-xs font-semibold text-muted-foreground">
                {zh ? "网络教练留言（视频求指导）" : "Network coach board (video requests)"}
              </p>
              {videoBoard.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? networkBoardTarget || readSelectedNetworkCoachId()
                      ? "上传完成后会出现求指导留言。"
                      : "先选择一位网络教练，上传后会同步留言。"
                    : networkBoardTarget || readSelectedNetworkCoachId()
                      ? "A coaching request will appear after upload."
                      : "Pick a network coach so the clip can be messaged."}
                </p>
              ) : (
                videoBoard.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card px-3 py-2"
                    data-message-id={item.id}
                    data-message-kind="video-guidance"
                  >
                    <p className="text-[11px] font-semibold text-muted-foreground">{formatTime(item.at)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.text}</p>
                    <p className="mt-1 text-[11px] font-semibold text-primary">
                      {zh ? "视频求指导已留言，等待教练回复" : "Video coaching request sent — waiting for coach"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-3" data-coach-panel="improve-plan" data-coach-main-panel="plan">
          <CoachProfileCard coachId={DEFAULT_COACH_ID as CoachId} />

          {planMessages.length === 0 && pending ? <LoadingState label={t("coach.building")} /> : null}
          {planMessages.length === 0 && error ? (
            <EmptyState title={t("coach.empty")} description={error}>
              <Button type="button" onClick={() => void askCoach([], { daily: true, improve: false })}>
                {t("common.retry")}
              </Button>
            </EmptyState>
          ) : null}

          <div className="space-y-3" data-coach-panel="ai-chat">
            {planMessages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground"
                      : "max-w-[85%] space-y-3 rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground"
                  }
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.plan ? <PlanCard plan={message.plan} t={t} /> : null}
                  {message.drill ? <DrillCard drill={message.drill} zh={zh} /> : null}
                </div>
              </div>
            ))}
            {pending && planMessages.length > 0 ? <LoadingState label={t("coach.reviewing")} /> : null}
            {latestDrill && !planMessages.some((m) => m.drill) ? <DrillCard drill={latestDrill} zh={zh} /> : null}
          </div>

          {confirmLabel ? (
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

          {chips.length ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <Button key={chip} type="button" variant="outline" size="sm" disabled={pending} onClick={() => send(chip)}>
                  {chip}
                </Button>
              ))}
            </div>
          ) : null}

          {improvePlan ? (
            <p className="text-xs text-muted-foreground">
              {confirmedImprove ? t("coach.improveConfirmed") : t("coach.improvePending")}
            </p>
          ) : null}

          <div className="space-y-2" data-coach-plan-tasks="true">
            <p className="text-xs font-semibold text-muted-foreground">{t("coach.tasks")}</p>
            {taskItems.length ? (
              taskItems.map((task) => <TaskCard key={task.id} task={task} t={t} />)
            ) : (
              <EmptyState title={t("coach.tasksEmpty")} description={t("coach.tasksEmptyDesc")} />
            )}
            {pending && confirmedImprove ? <LoadingState label={t("coach.reviewing")} /> : null}
          </div>

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
            {error && planMessages.length > 0 ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          </form>
        </section>
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
