"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { destForRole } from "@/lib/coach-home";
import { SHOW_ANALYSIS_TAB } from "@/lib/feature-flags";
import { isCoachSubmitLocked, subscribeCoachJob } from "@/lib/coach-active-job";
import { ensureJobWatch } from "@/lib/job-watch";
import { Bell, BotMessageSquare, ClipboardList, Film, MessageSquare, User, Video, Users } from "lucide-react";
import { AndroidApkBanner } from "@/components/android-apk-hint";
import { BrandMark } from "@/components/brand-mark";
import { Onboarding } from "@/components/onboarding";
import { ProfileSetup } from "@/components/profile-setup";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { useSessionRole } from "@/lib/session-role";
import { cn } from "@/lib/utils";

/** Warn only when leaving 教练 while coach video is uploading/analyzing. Never gates 通知. */
const SUBMIT_LOCK_MSG = "视频正在上传中";

const playerNavAll = [
  { href: "/analysis", key: "analysis", labelKey: "nav.analyze", icon: Video },
  { href: "/friends", key: "friends", labelKey: "nav.friends", icon: Users },
  { href: "/coach", key: "coach", labelKey: "nav.coach", icon: BotMessageSquare },
  { href: "/", key: "profile", labelKey: "nav.me", icon: User },
];

/** Flip SHOW_ANALYSIS_TAB in lib/feature-flags.ts to restore 「分析」. */
const playerNav = SHOW_ANALYSIS_TAB
  ? playerNavAll
  : playerNavAll.filter((item) => item.key !== "analysis");

const coachNav = [
  { href: "/students", key: "students", labelKey: "nav.students", icon: ClipboardList },
  { href: "/library", key: "library", labelKey: "library.nav", icon: Film },
  { href: "/inbox", key: "inbox", labelKey: "nav.inbox", icon: MessageSquare },
  { href: "/", key: "profile", labelKey: "nav.me", icon: User },
];

const profileRoutes = new Set(["/", "/notifications", "/notices", "/help", "/journey"]);

function isActive(pathname: string, href: string) {
  if (href === "/") return profileRoutes.has(pathname);
  if (href === "/analysis") {
    return (
      pathname === "/analysis" ||
      pathname.startsWith("/analysis/") ||
      pathname === "/reports" ||
      pathname.startsWith("/reports/") ||
      pathname.startsWith("/report")
    );
  }
  if (href === "/students") {
    return pathname === "/students" || pathname.startsWith("/students/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const session = useSessionRole();
  const nav = session.role === "coach" ? coachNav : playerNav;
  const [challengeBadge, setChallengeBadge] = useState(0);
  /** True only while coach video bytes uploading or analyze in flight. */
  const [coachBusy, setCoachBusy] = useState(() => isCoachSubmitLocked());

  useEffect(() => {
    const sync = () => setCoachBusy(isCoachSubmitLocked());
    sync();
    return subscribeCoachJob(sync);
  }, []);

  const onCoachTab = isActive(pathname, "/coach");
  /** Leave-tab dialog: only on 教练 + real upload/analyze. Never blocks 通知. */
  const submitLocked = coachBusy && onCoachTab;

  const refreshBadge = useCallback(async () => {
    if (session.role === "coach") {
      setChallengeBadge(0);
      return;
    }
    try {
      const res = await fetch("/tennis/api/friends/intros", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { badge?: number; pendingAccept?: unknown[] };
      const n =
        typeof data.badge === "number"
          ? data.badge
          : Array.isArray(data.pendingAccept)
            ? data.pendingAccept.length
            : 0;
      setChallengeBadge(n);
    } catch {
      /* ignore */
    }
  }, [session.role]);

  useEffect(() => {
    if (session.role !== "coach") return;
    const next = destForRole("coach", pathname);
    if (next !== pathname) router.replace(next);
  }, [pathname, router, session.role]);
  useEffect(() => {
    ensureJobWatch();
    const onVis = () => {
      if (document.visibilityState === "visible") ensureJobWatch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pathname]);

  useEffect(() => {
    void refreshBadge();
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshBadge();
    };
    document.addEventListener("visibilitychange", onVis);
    const timer = window.setInterval(() => void refreshBadge(), 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(timer);
    };
  }, [pathname, refreshBadge]);

  return (
    <div className="min-h-screen">
      <Onboarding />
      <ProfileSetup />
      <header className="fixed top-0 right-0 left-0 z-50 h-14 border-b border-border bg-background">
        <div className="mx-auto flex h-full w-full max-w-md items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark size={32} className="size-8 shrink-0" />
            <span className="truncate text-lg font-bold text-foreground">
              {t("brand")}
            </span>
          </div>
          <Link
            href="/notices"
            aria-label={t("notices.title")}
            data-action="open-notices"
            data-notices-badge={challengeBadge > 0 ? String(challengeBadge) : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "relative size-9 rounded-full text-muted-foreground hover:bg-muted",
            )}
          >
            <Bell className="size-5" />
            {challengeBadge > 0 ? (
              <span
                data-notices-badge-dot="true"
                className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
              >
                {challengeBadge > 9 ? "9+" : challengeBadge}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <main className="pt-14 pb-20">
        <AndroidApkBanner />
        {children}
      </main>

      <nav
        data-mobile-nav="global"
        data-submit-lock={submitLocked ? "1" : undefined}
        className="fixed right-0 bottom-0 left-0 z-50 h-16 border-t border-border bg-white"
      >
        <div className={cn("mx-auto grid h-full w-full max-w-md", nav.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const leaveBlocked = submitLocked && !isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                data-nav-key={item.key}
                data-active={active ? "true" : undefined}
                data-submit-lock={leaveBlocked ? "1" : undefined}
                aria-disabled={leaveBlocked || undefined}
                onClick={(event) => {
                  if (!leaveBlocked) return;
                  event.preventDefault();
                  window.alert(SUBMIT_LOCK_MSG);
                }}
                className={cn(
                  "flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-1",
                  active
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                  leaveBlocked ? "opacity-45" : null,
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="max-w-full truncate text-[11px] leading-none whitespace-nowrap">
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
