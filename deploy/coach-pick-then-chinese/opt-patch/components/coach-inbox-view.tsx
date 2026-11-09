"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { pageClass } from "@/lib/data";
import {
  findStudent,
  findThread,
  markThreadRead,
  readInbox,
  replyInbox,
  type InboxKind,
} from "@/lib/coach-workspace";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { appendNetworkBoard, readNetworkBoard } from "@/lib/network-coach-board";
import { PLAYER_SELECTED_COACH_KEY } from "@/lib/coach-publish";
import { DEFAULT_COACH_ID } from "@/lib/coach-roster";

const KIND_KEY: Record<InboxKind, string> = {
  message: "workspace.kindMessage",
  question: "workspace.kindQuestion",
  plan: "workspace.kindPlan",
  feedback: "workspace.kindFeedback",
};

function resolveCoachBoardId(): string {
  if (typeof window === "undefined") return "lin_kai";
  try {
    const selected = window.localStorage.getItem(PLAYER_SELECTED_COACH_KEY) || "";
    if (selected && selected !== DEFAULT_COACH_ID && selected !== "poppy" && selected !== "zhangqiu") {
      return selected;
    }
    const chat = window.localStorage.getItem("tennis-ai-coach-chat") || "";
    if (chat && chat !== DEFAULT_COACH_ID && chat !== "poppy" && chat !== "zhangqiu") return chat;
  } catch {
    /* ignore */
  }
  return "lin_kai";
}

export function CoachInboxView({ threadId = "" }: { threadId?: string }) {
  const { t, locale } = useI18n();
  const zh = locale === "zh" || (typeof locale === "string" && locale.startsWith("zh"));
  const [activeId, setActiveId] = useState(threadId);
  const [draft, setDraft] = useState("");
  const [tick, setTick] = useState(0);
  const [guidanceDraft, setGuidanceDraft] = useState("");
  const threads = useMemo(() => readInbox(), [tick]);
  const thread = activeId ? findThread(activeId) || threads.find((item) => item.id === activeId) || null : null;
  const student = thread ? findStudent(thread.studentId) : null;
  const boardId = resolveCoachBoardId();
  const recentGuidance = readNetworkBoard(boardId).filter((m) => m.from === "coach").slice(-6).reverse();

  function openThread(id: string) {
    markThreadRead(id);
    setActiveId(id);
    setDraft("");
    setTick((value) => value + 1);
  }

  function send() {
    if (!thread) return;
    const next = replyInbox(thread.id, draft);
    if (!next) return;
    // Mirror to the player-facing network coach board (真人教练指导通道).
    const studentLabel = student ? t(student.nameKey) : zh ? "学员" : "Student";
    appendNetworkBoard(boardId, {
      text: draft.trim(),
      from: "coach",
      kind: "guidance",
      status: "replied",
      studentKey: thread.studentId,
      studentLabel,
    });
    setDraft("");
    setTick((value) => value + 1);
  }

  function sendStandaloneGuidance() {
    const value = guidanceDraft.trim();
    if (!value) return;
    appendNetworkBoard(boardId, {
      text: value,
      from: "coach",
      kind: "guidance",
      status: "replied",
      studentKey: "default",
      studentLabel: zh ? "学员" : "Student",
    });
    setGuidanceDraft("");
    setTick((value) => value + 1);
  }

  return (
    <div className={pageClass} data-page="coach-inbox" data-inbox="true" data-coach-can-note="true">
      <div>
        <h1 className="text-base font-bold text-foreground">{t("workspace.inboxTitle")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {zh
            ? "真人教练指导通道：回复学员消息，或直接留言；学员在「我的教练」可见。"
            : "Human coaching channel: reply to students or leave notes they see under My Coaches."}
        </p>
      </div>

      <section className="space-y-2 rounded-lg border border-border bg-card px-3 py-3" data-coach-standalone-note="true">
        <p className="text-sm font-semibold text-foreground">{zh ? "给学员留言指导" : "Leave student guidance"}</p>
        <Textarea
          className="min-h-16"
          value={guidanceDraft}
          onChange={(event) => setGuidanceDraft(event.target.value)}
          placeholder={zh ? "写一条指导留言…" : "Write a guidance note…"}
          data-coach-guidance-draft="true"
        />
        <Button type="button" size="sm" data-coach-guidance-send="true" onClick={sendStandaloneGuidance}>
          {zh ? "发送留言" : "Send note"}
        </Button>
        {recentGuidance.length ? (
          <div className="space-y-1.5" data-coach-guidance-history="true">
            {recentGuidance.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                <p className="font-semibold text-muted-foreground">
                  {item.studentLabel || (zh ? "学员" : "Student")} · {item.at.slice(5, 16).replace("T", " ")}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {thread && student ? (
        <section className="space-y-3" data-inbox-thread={thread.id}>
          <button type="button" className="text-xs font-medium text-primary" onClick={() => setActiveId("")}>
            {t("workspace.backInbox")}
          </button>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t(student.nameKey)} · {t(KIND_KEY[thread.kind])}
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">{t(thread.titleKey)}</h2>
          </div>
          <div className="space-y-2">
            {thread.messages.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  item.from === "coach" ? "bg-primary-subtle text-foreground" : "border border-border bg-card",
                )}
              >
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {item.from === "coach" ? t("common.coach") : t(student.nameKey)} · {item.when}
                </p>
                <p className="mt-1 leading-6">{item.text || (item.textKey ? t(item.textKey) : "")}</p>
              </div>
            ))}
          </div>
          <Textarea
            className="min-h-16"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("workspace.replyPh")}
            data-inbox-reply="true"
          />
          <Button type="button" size="sm" data-inbox-send="true" onClick={send}>
            {t("workspace.sendReply")}
          </Button>
        </section>
      ) : threads.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {threads.map((item, index) => {
            const who = findStudent(item.studentId);
            return (
              <button
                key={item.id}
                type="button"
                data-inbox-item={item.id}
                onClick={() => openThread(item.id)}
                className={`flex w-full items-start justify-between px-3 py-3 text-left hover:bg-muted ${
                  index === threads.length - 1 ? "" : "border-b border-border"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{t(item.titleKey)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {who ? t(who.nameKey) : ""} · {t(KIND_KEY[item.kind])} · {item.when}
                  </p>
                </div>
                {item.unread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState title={t("workspace.emptyInbox")} description={t("workspace.inboxLead")} />
      )}
    </div>
  );
}
