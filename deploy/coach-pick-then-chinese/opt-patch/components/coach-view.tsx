"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, EmptyState } from "@/components/empty-state";
import {
  resolvePhase,
  videoForSkill,
  type ChatMessage,
  type CoachPlan,
  type CoachResponse,
  type ExampleVideo,
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
import { useSessionRole } from "@/lib/session-role";
import {
  appendNetworkBoard,
  listStudentKeysForCoach,
  readNetworkBoard,
  type NetworkBoardMessage,
} from "@/lib/network-coach-board";

type UiMessage = {
  id: string;
  role: "coach" | "user";
  text: string;
  plan?: CoachPlan | null;
  planKind?: "improve";
  drill?: CoachDrill | null;
  kind?: "video-guidance";
  /** Compact 视频讲解 link for freeform / plan advice (not the eight-technique drill box). */
  videoSuggestion?: ExampleVideo | null;
};

/** Top-level coach sub-tabs: video guidance + improvement plan. */
type MainTab = "video" | "plan";

const MAIN_TAB_KEY = "tennis-coach-main-tab-v1";
const ACTIVE_NETWORK_KEY = "tennis-ai-active-network-coach";

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

function rememberNetworkCoach(id: string) {
  if (typeof window === "undefined" || !id || isAiCoach(id)) return;
  try {
    window.localStorage.setItem(ACTIVE_NETWORK_KEY, id);
    window.localStorage.setItem(PLAYER_SELECTED_COACH_KEY, id);
  } catch {
    /* ignore */
  }
}

function studentSelfKey(session: { phone?: string; displayName?: string }) {
  return session.phone || session.displayName || "default";
}

function studentSelfLabel(session: { phone?: string; displayName?: string }, zh: boolean) {
  return session.displayName || session.phone || (zh ? "我" : "Me");
}

/** Infer a demo video topic from freeform goals (球速 / 力量 / …). */
function inferVideoTopic(text: string): string {
  const blob = String(text || "");
  if (/球速|速度|加速|更快|力量|发力|转速|拍头速度/i.test(blob)) {
    if (/发球|一发|二发|serve/i.test(blob)) return "serve";
    if (/反手|backhand/i.test(blob)) return "bh-topspin";
    return "fh-topspin";
  }
  if (/步法|移动|到位|分腿|footwork/i.test(blob)) return "footwork";
  if (/发球|serve/i.test(blob)) return "serve";
  if (/反手|backhand/i.test(blob)) return "bh-topspin";
  if (/正手|forehand|上旋/i.test(blob)) return "fh-topspin";
  if (/稳定|一致性|容错/i.test(blob)) return "fh-topspin";
  return "fh-topspin";
}

function isFreeformGoal(text: string) {
  return /提高|提升|改进|想要|希望|球速|力量|稳定|一致性|耐力|信心|比赛|紧张/i.test(text);
}

export function CoachView() {
  const { t, locale } = useI18n();
  const session = useSessionRole();
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
  const [board, setBoard] = useState<NetworkBoardMessage[]>([]);
  const [coachNoteDraft, setCoachNoteDraft] = useState("");
  const [coachNoteStudent, setCoachNoteStudent] = useState("default");
  const [coachNoteTick, setCoachNoteTick] = useState(0);

  const phase = resolvePhase(true, confirmedImprove);
  const zh = locale === "zh" || (typeof locale === "string" && locale.startsWith("zh"));
  const chattingBuiltIn = isAiCoach(coachId);
  const isCoachRole = session.role === "coach";

  const videoMessages = messages.filter((m) => m.kind === "video-guidance");
  const planMessages = messages.filter((m) => m.kind !== "video-guidance");
  const videoBoard = board.filter((m) => m.kind === "video-guidance" || m.from === "coach" || !m.kind);
  const networkBoardTarget =
    (!isAiCoach(coachId) ? coachId : "") ||
    (activePersona?.kind === "network" ? activePersona.id : "") ||
    readSelectedNetworkCoachId() ||
    "";

  const coachBoardId = networkBoardTarget || readSelectedNetworkCoachId() || "lin_kai";
  const studentOptions = listStudentKeysForCoach(coachBoardId);

  function selectMainTab(tab: MainTab) {
    setMainTab(tab);
    writeMainTab(tab);
    if (tab === "plan" && planMessages.length === 0 && !pending && chattingBuiltIn) {
      void askCoach([], { daily: true, improve: false }, DEFAULT_COACH_ID);
    }
  }

  function resetThread(nextId: string, persona?: ChatPersona | null) {
    setCoachId(nextId);
    writeActiveChatCoach(nextId);
    if (isAiCoach(nextId)) {
      writeCoachId(DEFAULT_COACH_ID as CoachId);
    } else {
      rememberNetworkCoach(nextId);
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
      setBoard(readNetworkBoard(nextId));
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
        | (CoachResponse & {
            error?: string;
            coachName?: string;
            videoSuggestion?: ExampleVideo | null;
            suggestVideoSkill?: string;
          })
        | null;
      if (!response.ok || !payload?.text) {
        setError(payload?.error && !/[\u4e00-\u9fff]/.test(payload.error) ? payload.error : t("coach.retry"));
        return;
      }
      if (payload.improvePlan) setImprovePlan(payload.improvePlan);
      const plan = payload.improvePlan || payload.dailyPlan || null;
      const lastUser = [...nextHistory].reverse().find((m) => m.role === "user")?.content || "";
      let videoSuggestion = payload.videoSuggestion || null;
      if (!videoSuggestion && !payload.drill) {
        const skill =
          payload.suggestVideoSkill ||
          (isFreeformGoal(lastUser) || flags.improve ? inferVideoTopic(lastUser || payload.text) : "");
        if (skill) videoSuggestion = videoForSkill(skill, locale === "zh" || String(locale).startsWith("zh") ? "zh" : "en");
      }
      setHistory([...nextHistory, { role: "assistant", content: payload.text }]);
      setMessages((current) => [
        ...current,
        {
          id: nextId("c"),
          role: "coach",
          text: payload.text,
          plan,
          planKind: plan ? "improve" : undefined,
          drill: payload.drill || null,
          videoSuggestion,
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
      setBoard(readNetworkBoard(coachId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    if (!networkBoardTarget) return;
    setBoard(readNetworkBoard(networkBoardTarget));
  }, [networkBoardTarget, coachNoteTick, mainTab]);

  function send(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    setDraft("");
    if (!chattingBuiltIn) {
      leaveStudentMessage(value);
      return;
    }
    const user: ChatMessage = { role: "user", content: value };
    const nextHistory = [...history, user];
    setMessages((current) => [...current, { id: nextId("u"), role: "user", text: value }]);
    void askCoach(nextHistory, { daily: true, improve: confirmedImprove });
  }

  function leaveStudentMessage(text: string, opts?: { kind?: "video-guidance"; jobId?: string; targetCoachId?: string }) {
    const value = text.trim();
    const target = opts?.targetCoachId || coachId;
    if (!value || isAiCoach(target)) return;
    if (!opts?.kind) setDraft("");
    const item = appendNetworkBoard(target, {
      text: value,
      from: "student",
      status: "pending",
      kind: opts?.kind || "note",
      jobId: opts?.jobId,
      studentKey: studentSelfKey(session),
      studentLabel: studentSelfLabel(session, zh),
    });
    if (!item) return;
    if (target === coachId || target === networkBoardTarget) {
      setBoard(readNetworkBoard(target));
    }
  }

  function leaveCoachGuidanceNote() {
    const value = coachNoteDraft.trim();
    if (!value) return;
    const target = coachBoardId;
    const student = studentOptions.find((s) => s.key === coachNoteStudent) || studentOptions[0];
    appendNetworkBoard(target, {
      text: value,
      from: "coach",
      status: "replied",
      kind: "guidance",
      studentKey: student?.key || "default",
      studentLabel: student?.label || (zh ? "学员" : "Student"),
    });
    setCoachNoteDraft("");
    setCoachNoteTick((n) => n + 1);
    setBoard(readNetworkBoard(target));
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
      leaveStudentMessage(bundle.networkText, {
        kind: "video-guidance",
        jobId: meta.jobId,
        targetCoachId: networkId,
      });
      setBoard(readNetworkBoard(networkId));
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
    ? ["我想学正手上旋", "我想学反手上旋", "我想学发球", "我要提高球速", t("coach.chipTwice"), t("coach.chipContact")]
    : ["Learn topspin forehand", "Learn backhand topspin", "Learn serve", "I want more ball speed", t("coach.chipTwice"), t("coach.chipContact")];
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

  const coachNotesPanel = isCoachRole ? (
    <section
      className="space-y-2 rounded-lg border border-border bg-card px-3 py-3"
      data-coach-network-notes="true"
      data-role="coach"
    >
      <p className="text-sm font-semibold text-foreground">{zh ? "给学员留言指导" : "Leave guidance for students"}</p>
      <p className="text-xs text-muted-foreground">
        {zh
          ? "真人教练指导通道：留言会出现在学员的「我的教练」里，不限于 AI。"
          : "Human coaching channel: notes appear on the player's My Coaches board."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="coach-note-student">
          {zh ? "学员" : "Student"}
        </label>
        <select
          id="coach-note-student"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={coachNoteStudent}
          onChange={(e) => setCoachNoteStudent(e.target.value)}
          data-coach-note-student="true"
        >
          {studentOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
              {s.count ? ` (${s.count})` : ""}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        className="min-h-20"
        value={coachNoteDraft}
        onChange={(e) => setCoachNoteDraft(e.target.value)}
        placeholder={zh ? "写一条指导留言…" : "Write a guidance note…"}
        data-coach-note-draft="true"
      />
      <Button type="button" size="sm" data-coach-note-send="true" onClick={leaveCoachGuidanceNote}>
        {zh ? "发送留言" : "Send note"}
      </Button>
      <div className="space-y-2" data-coach-note-history="true">
        {readNetworkBoard(coachBoardId)
          .filter((m) => m.from === "coach")
          .slice(-8)
          .reverse()
          .map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              <p className="font-semibold text-muted-foreground">
                {formatTime(item.at)}
                {item.studentLabel ? ` · ${item.studentLabel}` : ""}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.text}</p>
            </div>
          ))}
      </div>
    </section>
  ) : null;

  return (
    <div
      className={pageClass}
      data-network-coach-chat="true"
      data-coach-mode={chattingBuiltIn ? "ai-chat" : "human-message"}
      data-coach-main-tab={mainTab}
      data-coach-pick-first="true"
    >
      <h1 className="text-base font-bold text-foreground">{zh ? "我的教练" : "My coaches"}</h1>
      <p className="text-xs text-muted-foreground">
        {zh
          ? "先选择涨球 AI 教练或网络教练；选择对「视频指导」与「改进计划」都生效。"
          : "Pick Zhangqiu AI or a network coach first; the choice applies to Video guidance and Improvement plan."}
      </p>

      {/* 我的教练 → 选教练，排在视频指导 / 改进计划之前 */}
      <section className="space-y-2" data-coach-pick-section="true" data-coach-pick-before-tabs="true">
        <p className="text-xs font-semibold text-muted-foreground">{zh ? "选择教练" : "Choose a coach"}</p>
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
      </section>

      {coachNotesPanel}

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
                      : "max-w-[85%] space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground"
                  }
                  data-message-kind="video-guidance"
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.role === "coach" ? (
                    <p className="text-[11px] font-semibold text-primary">
                      {zh ? "涨球教练 · 视频指导" : "Zhangqiu Coach · video guidance"}
                    </p>
                  ) : null}
                  {message.drill ? <DrillCard drill={message.drill} zh={zh} compact /> : null}
                  {message.videoSuggestion ? <VideoLessonCard video={message.videoSuggestion} zh={zh} t={t} /> : null}
                </div>
              </div>
            ))}
            {videoDrill && !videoMessages.some((m) => m.drill) ? <DrillCard drill={videoDrill} zh={zh} compact /> : null}

            <div className="space-y-2" data-coach-panel="human-board" data-board-scope="video-guidance">
              <p className="text-xs font-semibold text-muted-foreground">
                {zh ? "网络教练留言" : "Network coach notes"}
              </p>
              {videoBoard.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? networkBoardTarget || readSelectedNetworkCoachId()
                      ? "上传后会同步求指导；网络教练的回复也会出现在这里。"
                      : "先选择一位网络教练，上传后会同步留言。"
                    : networkBoardTarget || readSelectedNetworkCoachId()
                      ? "A coaching request will appear after upload; coach replies show here too."
                      : "Pick a network coach so the clip can be messaged."}
                </p>
              ) : (
                videoBoard.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card px-3 py-2"
                    data-message-id={item.id}
                    data-message-from={item.from}
                    data-message-kind={item.kind || "note"}
                  >
                    <p className="text-[11px] font-semibold text-muted-foreground">{formatTime(item.at)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.text}</p>
                    <p className="mt-1 text-[11px] font-semibold text-primary">
                      {item.from === "coach"
                        ? zh
                          ? "网络教练指导"
                          : "Network coach guidance"
                        : item.kind === "video-guidance"
                          ? zh
                            ? "视频求指导已留言，等待教练回复"
                            : "Video coaching request sent — waiting for coach"
                          : zh
                            ? "已留言，等待教练回复"
                            : "Sent — waiting for coach"}
                    </p>
                  </div>
                ))
              )}
            </div>

            {!chattingBuiltIn ? (
              <form
                className="space-y-2"
                data-coach-composer="network"
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
                    placeholder={zh ? "给网络教练留言…" : "Message your network coach…"}
                    aria-label={zh ? "给网络教练留言" : "Message network coach"}
                    className="h-10 bg-background"
                    disabled={pending}
                  />
                  <Button type="submit" className="h-10 px-4" disabled={pending}>
                    {t("common.send")}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-3" data-coach-panel="improve-plan" data-coach-main-panel="plan" data-plan-zh-only={zh ? "true" : undefined}>
          {chattingBuiltIn ? <CoachProfileCard coachId={DEFAULT_COACH_ID as CoachId} /> : null}

          {!chattingBuiltIn ? (
            <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-3" data-plan-network-notes="true">
              <p className="text-sm font-semibold">{zh ? "网络教练 · 改进相关留言" : "Network coach · plan notes"}</p>
              <p className="text-xs text-muted-foreground">
                {zh
                  ? "你选的网络教练可在此留言；涨球 AI 改进计划请切回涨球教练查看。"
                  : "Notes from your selected network coach. Switch to Zhangqiu Coach for the AI plan."}
              </p>
              {board.filter((m) => m.from === "coach" || m.kind === "guidance" || m.kind === "note").length === 0 ? (
                <EmptyState
                  title={zh ? "还没有教练留言" : "No coach notes yet"}
                  description={zh ? "网络教练登录后可直接给你留言指导。" : "Your network coach can leave guidance after login."}
                />
              ) : (
                board
                  .filter((m) => m.from === "coach" || m.kind === "guidance" || m.kind === "note")
                  .map((item) => (
                    <div key={item.id} className="rounded-md border border-border bg-background px-3 py-2" data-message-from={item.from}>
                      <p className="text-[11px] font-semibold text-muted-foreground">{formatTime(item.at)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{item.text}</p>
                      {item.from === "coach" ? (
                        <p className="mt-1 text-[11px] font-semibold text-primary">{zh ? "网络教练指导" : "Network coach guidance"}</p>
                      ) : null}
                    </div>
                  ))
              )}
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(draft);
                }}
              >
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={zh ? "向网络教练提问或留言…" : "Ask or message your network coach…"}
                    className="h-10 bg-background"
                  />
                  <Button type="submit" className="h-10 px-4">
                    {t("common.send")}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}

          {chattingBuiltIn && planMessages.length === 0 && pending ? <LoadingState label={t("coach.building")} /> : null}
          {chattingBuiltIn && planMessages.length === 0 && error ? (
            <EmptyState title={t("coach.empty")} description={error}>
              <Button type="button" onClick={() => void askCoach([], { daily: true, improve: false })}>
                {t("common.retry")}
              </Button>
            </EmptyState>
          ) : null}

          {chattingBuiltIn ? (
            <>
              <div className="space-y-3" data-coach-panel="ai-chat">
                {planMessages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground"
                          : "max-w-[85%] space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground"
                      }
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      {message.plan ? <PlanCard plan={message.plan} t={t} /> : null}
                      {message.drill ? <DrillCard drill={message.drill} zh={zh} compact /> : null}
                      {message.videoSuggestion ? <VideoLessonCard video={message.videoSuggestion} zh={zh} t={t} /> : null}
                    </div>
                  </div>
                ))}
                {pending && planMessages.length > 0 ? <LoadingState label={t("coach.reviewing")} /> : null}
                {latestDrill && !planMessages.some((m) => m.drill) ? <DrillCard drill={latestDrill} zh={zh} compact /> : null}
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
                <div className="flex flex-wrap gap-2" data-coach-chips="true">
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

              {/* 「当前任务」已移除 — 计划确认后继续对话 + 视频讲解 */}

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
                    placeholder={zh ? "说说你的目标，例如：我要提高球速…" : "Tell Zhangqiu Coach your goal…"}
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
            </>
          ) : null}
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

/** Compact eight-technique cues — less dominant than the old full drill box. */
function DrillCard({ drill, zh, compact }: { drill: CoachDrill; zh: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const preview = drill.steps.slice(0, 1);
  const rest = drill.steps.slice(1);
  return (
    <div
      className={cn(
        "rounded border border-border/80 bg-background/80",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      )}
      data-coach-drill={drill.strokeId}
      data-drill-title={drill.title}
      data-drill-compact={compact ? "true" : undefined}
    >
      <p className={cn("font-semibold text-primary", compact ? "text-[10px]" : "text-xs")}>
        {zh ? "要点速览" : "Cue sheet"}
      </p>
      <p className={cn("mt-0.5 font-medium text-foreground", compact ? "text-xs" : "text-sm")}>{drill.title}</p>
      <ol className={cn("mt-1 space-y-1 text-muted-foreground", compact ? "text-[10px] leading-4" : "text-xs")} data-drill-steps="true">
        {(open ? drill.steps : preview).map((step) => (
          <li key={step.phase} data-drill-phase={step.phase}>
            <span className="font-semibold text-foreground">{step.phase}</span>
            <span className="text-muted-foreground"> · {(open ? step.cues : step.cues.slice(0, 2)).join("；")}</span>
          </li>
        ))}
      </ol>
      {rest.length ? (
        <button
          type="button"
          className="mt-1 text-[10px] font-semibold text-primary"
          data-drill-toggle="true"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (zh ? "收起" : "Hide") : zh ? `展开全部 ${drill.steps.length} 步` : `Show all ${drill.steps.length} steps`}
        </button>
      ) : null}
    </div>
  );
}

function VideoLessonCard({
  video,
  zh,
  t,
}: {
  video: ExampleVideo;
  zh: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const channelLabel = zh ? "视频讲解" : video.channel;
  return (
    <div
      className="overflow-hidden rounded border border-border/80 bg-background/80"
      data-coach-video-lesson="true"
      data-video-skill={String(video.skill)}
    >
      <div className="px-2 pt-1.5">
        <p className="text-[10px] font-semibold text-primary">{zh ? "视频讲解" : "Video lesson"}</p>
        <p className="text-xs font-medium text-foreground">{video.title}</p>
      </div>
      <div className="mt-1 aspect-video bg-muted">
        <iframe
          title={video.title}
          src={video.embedUrl}
          className="h-full w-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="px-2 py-1.5 text-[10px]">
        <a className="font-semibold text-primary underline" href={video.url} target="_blank" rel="noreferrer">
          {zh ? `打开${channelLabel}` : t("coach.openChannel", { channel: video.channel })}
        </a>
        {video.notes ? <p className="mt-0.5 text-muted-foreground">{video.notes}</p> : null}
      </div>
    </div>
  );
}
