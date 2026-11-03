"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitch } from "@/components/language-switch";
import {
  Bell,
  Bluetooth,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  FileText,
  HelpCircle,
  Target,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { WeekStrip } from "@/components/week-strip";
import { profile } from "@/lib/data";
import { RoleBadge } from "@/components/role-badge";
import { refreshSessionProfile, useSessionRole } from "@/lib/session-role";
import { coachStudents, studentAnalyses } from "@/lib/coach-workspace";

const settings: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/journey", labelKey: "journey.title", icon: TrendingUp },
  { href: "/analysis", labelKey: "profile.reports", icon: FileText },
  { href: "/plan", labelKey: "profile.plan", icon: CalendarCheck },
  { href: "/devices", labelKey: "profile.devices", icon: Bluetooth },
  { href: "/notifications", labelKey: "profile.notifications", icon: Bell },
  { href: "/help", labelKey: "profile.help", icon: HelpCircle },
];

const coachSettings: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/students", labelKey: "nav.students", icon: FileText },
  { href: "/library", labelKey: "library.nav", icon: FileText },
  { href: "/inbox", labelKey: "nav.inbox", icon: Bell },
  { href: "/help", labelKey: "profile.help", icon: HelpCircle },
];

export function ProfileView() {
  const { t, locale } = useI18n();
  const session = useSessionRole();
  const isCoach = session.role === "coach";
  const menus = isCoach ? coachSettings : settings;
  const zh = locale !== "en";
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  useEffect(() => {
    setNameDraft(session.displayName || "");
  }, [session.displayName]);

  async function saveDisplayName() {
    const next = nameDraft.trim();
    setSaving(true);
    setSaveNote("");
    try {
      const res = await fetch("/tennis/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: next }),
      });
      const data = (await res.json()) as { error?: string; displayName?: string };
      if (!res.ok) {
        setSaveNote(data.error || (zh ? "保存失败" : "Save failed"));
        return;
      }
      await refreshSessionProfile();
      setNameDraft(String(data.displayName || next));
      setSaveNote(zh ? "已保存显示名" : "Display name saved");
    } catch {
      setSaveNote(zh ? "保存失败" : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const shownName =
    (session.displayName || nameDraft || "").trim() ||
    (zh ? "未设置显示名" : "No display name yet");

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-4">
      <section
        id="profile-card"
        className="rounded-lg bg-gradient-to-br from-primary to-primary-hover p-5 text-primary-foreground"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-primary-foreground/30 bg-primary-foreground/20">
            <User className="size-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold" data-profile-display-name="true">
                {shownName}
              </h1>
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[11px] font-semibold">
                {profile.level}
              </span>
              <RoleBadge />
            </div>
            <p className="mt-1 truncate text-xs opacity-90">
              {session.phone ? session.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2") : t("profile.bio")}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 rounded-md bg-primary-foreground/10 p-3">
          <label className="block text-[11px] opacity-90">
            {zh ? "显示名（球友/教练可见）" : "Display name (shown to friends/coaches)"}
          </label>
          <div className="flex gap-2">
            <input
              data-profile-name-input="true"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={zh ? "填写真实显示名" : "Your real display name"}
              className="h-9 min-w-0 flex-1 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-2.5 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/50"
            />
            <button
              type="button"
              data-profile-name-save="true"
              disabled={saving}
              onClick={() => void saveDisplayName()}
              className="h-9 shrink-0 rounded-md bg-primary-foreground/20 px-3 text-xs font-semibold hover:bg-primary-foreground/30 disabled:opacity-60"
            >
              {saving ? (zh ? "保存中…" : "Saving…") : zh ? "保存" : "Save"}
            </button>
          </div>
          {saveNote ? <p className="text-[11px] opacity-90">{saveNote}</p> : null}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-primary-foreground/10 p-3">
          <div className="text-center">
            <p className="text-lg font-bold">{isCoach ? coachStudents.length : profile.analyses}</p>
            <p className="text-[11px] opacity-80">{isCoach ? t("workspace.students") : t("profile.analyses")}</p>
          </div>
          <div className="border-l border-primary-foreground/20 text-center">
            <p className="text-lg font-bold">{t("profile.hoursValue")}</p>
            <p className="text-[11px] opacity-80">{t("profile.hours")}</p>
          </div>
          <div className="border-l border-primary-foreground/20 text-center">
            <p className="text-lg font-bold">{isCoach ? studentAnalyses.length : 0}</p>
            <p className="text-[11px] opacity-80">{isCoach ? t("workspace.analyses") : t("profile.friends")}</p>
          </div>
        </div>
      </section>

      <section id="my-data" className={isCoach ? "hidden" : "space-y-3"}>
        <h2 className="text-base font-bold text-foreground">{t("profile.myStats")}</h2>
        <Link
          href="/journey"
          data-action="open-journey"
          className="block rounded-lg border border-border bg-card p-4 hover:bg-muted"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("journey.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("profile.journeyLead")}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="size-4" />
              <span className="text-xs font-medium">{t("profile.gradeTrend")}</span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-2xl font-bold text-foreground">{profile.rating}</span>
              <div className="mb-1 flex gap-2 text-sm font-semibold text-foreground">
                <span>A</span>
                <span>B</span>
                <span>C</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="size-4" />
              <span className="text-xs font-medium">{t("profile.mostPracticed")}</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{t("stroke.forehand")}</p>
            <p className="text-xs text-muted-foreground">{t("profile.focusShare")}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4" />
              <span className="text-xs font-medium">{t("profile.weekDays")}</span>
            </div>
            <span className="text-sm font-bold text-foreground">{t("profile.weekCount")}</span>
          </div>
          <div className="mt-3">
            <WeekStrip />
          </div>
        </div>
      </section>

      <section id="settings-menu" className="space-y-3">
        <h2 className="text-base font-bold text-foreground">{t("profile.settings")}</h2>
        <div className="rounded-lg border border-border bg-card p-4" data-settings-lang="true">
          <LanguageSwitch />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {menus.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted ${
                  index === menus.length - 1 ? "" : "border-b border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-primary" />
                  <span className="text-sm text-foreground">{t(item.labelKey)}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
        <LogoutButton />
      </section>
    </div>
  );
}
