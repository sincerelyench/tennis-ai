"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { pageClass } from "@/lib/data";
import { analysesForStudent, coachStudents } from "@/lib/coach-workspace";
import { useI18n } from "@/components/i18n-provider";
import { appendNetworkBoard } from "@/lib/network-coach-board";
import { PLAYER_SELECTED_COACH_KEY } from "@/lib/coach-publish";
import { DEFAULT_COACH_ID } from "@/lib/coach-roster";

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

export function CoachStudentsView() {
  const { t, locale } = useI18n();
  const zh = locale === "zh" || (typeof locale === "string" && locale.startsWith("zh"));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Record<string, string>>({});
  const boardId = resolveCoachBoardId();

  function sendNote(studentId: string, nameKey: string) {
    const text = (drafts[studentId] || "").trim();
    if (!text) return;
    appendNetworkBoard(boardId, {
      text,
      from: "coach",
      kind: "guidance",
      status: "replied",
      studentKey: studentId,
      studentLabel: t(nameKey),
    });
    setDrafts((prev) => ({ ...prev, [studentId]: "" }));
    setSent((prev) => ({ ...prev, [studentId]: zh ? "已发送到学员「我的教练」" : "Sent to player's My Coaches" }));
  }

  return (
    <div className={pageClass} data-page="coach-students" data-coach-home="true" data-coach-can-note="true">
      <div>
        <h1 className="text-base font-bold text-foreground">{t("workspace.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("workspace.lead")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {zh
            ? "可直接给学员留言指导（真人教练通道，不只 AI）。"
            : "Leave guidance notes for students (human coaching channel, not only AI)."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t("workspace.studentCount", { n: coachStudents.length })}</p>
      </div>
      {coachStudents.map((student) => {
        const rows = analysesForStudent(student.id);
        return (
          <section key={student.id} className="space-y-2" data-student={student.id}>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t(student.nameKey)}</h2>
              <p className="text-xs text-muted-foreground">
                {t(student.levelKey)} · {t(student.noteKey)}
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {rows.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/students/analysis/${item.id}`}
                  data-student-analysis={item.id}
                  className={`flex items-center justify-between px-3 py-3 hover:bg-muted ${
                    index === rows.length - 1 ? "" : "border-b border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t(item.strokeKey)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.when} · {t("workspace.openAnalysis")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-foreground">
                    {item.score} · {item.grade}
                  </span>
                </Link>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2" data-student-note={student.id}>
              <p className="text-xs font-semibold text-muted-foreground">{zh ? "给这位学员留言" : "Note for this student"}</p>
              <Textarea
                className="min-h-14"
                value={drafts[student.id] || ""}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [student.id]: e.target.value }))}
                placeholder={zh ? "写一条指导留言…" : "Write a guidance note…"}
                data-student-note-draft={student.id}
              />
              <Button type="button" size="sm" data-student-note-send={student.id} onClick={() => sendNote(student.id, student.nameKey)}>
                {zh ? "发送留言" : "Send note"}
              </Button>
              {sent[student.id] ? <p className="text-[11px] font-semibold text-primary">{sent[student.id]}</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
