"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AndroidApkLink } from "@/components/android-apk-hint";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitch } from "@/components/language-switch";
import {
  Bell,
  ChevronRight,
  FileText,
  HelpCircle,
  MapPin,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { profile } from "@/lib/data";
import { RoleBadge } from "@/components/role-badge";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { refreshSessionProfile, useSessionRole } from "@/lib/session-role";
import {
  CITY_STORAGE_KEY,
  DEFAULT_CITY_ID,
  citiesForLocale,
  cityLabel,
  getCity,
  loadStoredCityId,
  matchCityFromGeo,
  persistCityId,
} from "@/lib/cities";
import { SHOW_ANALYSIS_TAB } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const settingsAll: { href: string; labelKey: string; icon: LucideIcon }[] = [
  // 成长旅程仅保留「我的数据」卡片一处入口，避免设置菜单重复
  { href: "/analysis", labelKey: "profile.reports", icon: FileText },
  // 训练计划 / 设备入口已移除（与 remove-settings-devices peer 合并，避免互相覆盖）
  { href: "/notifications", labelKey: "profile.notifications", icon: Bell },
  { href: "/help", labelKey: "profile.help", icon: HelpCircle },
];

/** Hide analysis/reports entry while SHOW_ANALYSIS_TAB is false. */
const settings = SHOW_ANALYSIS_TAB
  ? settingsAll
  : settingsAll.filter((item) => item.href !== "/analysis");

const coachSettings: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/students", labelKey: "nav.students", icon: FileText },
  { href: "/library", labelKey: "library.nav", icon: FileText },
  { href: "/inbox", labelKey: "nav.inbox", icon: Bell },
  { href: "/help", labelKey: "profile.help", icon: HelpCircle },
];

type ProfileTab = "overview" | "matches";

const PROFILE_TAB_KEY = "zq-profile-main-tab-v1";

type MatchScoreRow = {
  id: string;
  status: "pending" | "confirmed" | "rejected" | string;
  format?: string;
  createdAt?: string;
  confirmedAt?: string | null;
  playerA: string;
  playerB: string;
  sets: [number, number][];
  winner: "A" | "B";
};

function readProfileTab(): ProfileTab {
  try {
    const raw = window.localStorage.getItem(PROFILE_TAB_KEY);
    if (raw === "matches" || raw === "overview") return raw;
  } catch {
    /* ignore */
  }
  return "overview";
}

function writeProfileTab(tab: ProfileTab) {
  try {
    window.localStorage.setItem(PROFILE_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

function normName(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function formatSets(sets: [number, number][]): string {
  return (sets || []).map(([a, b]) => `${a}-${b}`).join(" · ");
}

async function detectCityFromIp(locale: string): Promise<string> {
  const pool = citiesForLocale(locale);
  try {
    const res = await fetch("/tennis/api/geo/city", { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as {
        cityId?: string;
        city?: string;
        region?: string;
        countryCode?: string;
      };
      if (data.cityId && pool.some((c) => c.id === data.cityId)) return data.cityId;
      const matched = matchCityFromGeo(data);
      if (matched && pool.some((c) => c.id === matched.id)) return matched.id;
      if (!locale.toLowerCase().startsWith("zh") && matched) return matched.id;
    }
  } catch {
    /* fall through */
  }
  if (pool.some((c) => c.id === DEFAULT_CITY_ID)) return DEFAULT_CITY_ID;
  return pool[0]?.id || DEFAULT_CITY_ID;
}

export function ProfileView() {
  const { t, locale } = useI18n();
  const session = useSessionRole();
  const isCoach = session.role === "coach";
  const menus = isCoach ? coachSettings : settings;
  const zh = locale !== "en";
  const cityOptions = useMemo(() => citiesForLocale(locale), [locale]);
  const [nameDraft, setNameDraft] = useState("");
  const [cityId, setCityId] = useState<string>(DEFAULT_CITY_ID);
  const [cityReady, setCityReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCity, setSavingCity] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [cityNote, setCityNote] = useState("");
  const [mainTab, setMainTab] = useState<ProfileTab>("overview");
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [confirmedMatches, setConfirmedMatches] = useState<MatchScoreRow[]>([]);

  useEffect(() => {
    setMainTab(readProfileTab());
  }, []);

  useEffect(() => {
    setNameDraft(session.displayName || "");
  }, [session.displayName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromAuth = String(session.cityId || "").trim();
      if (fromAuth && cityOptions.some((c) => c.id === fromAuth)) {
        if (!cancelled) {
          setCityId(fromAuth);
          persistCityId(fromAuth);
          setCityReady(true);
        }
        return;
      }
      const stored = loadStoredCityId();
      if (stored && cityOptions.some((c) => c.id === stored)) {
        if (!cancelled) {
          setCityId(stored);
          setCityReady(true);
        }
        return;
      }
      const detected = await detectCityFromIp(locale);
      if (!cancelled) {
        setCityId(detected);
        setCityReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, cityOptions, session.cityId]);

  useEffect(() => {
    if (!cityOptions.some((c) => c.id === cityId)) {
      const next = cityOptions.some((c) => c.id === DEFAULT_CITY_ID)
        ? DEFAULT_CITY_ID
        : cityOptions[0]?.id || DEFAULT_CITY_ID;
      setCityId(next);
    }
  }, [cityOptions, cityId]);

  const loadMatchHistory = useCallback(async () => {
    if (isCoach) return;
    setMatchesLoading(true);
    setMatchesError("");
    try {
      const res = await fetch("/tennis/api/friends/scores", { credentials: "include" });
      if (!res.ok) {
        setConfirmedMatches([]);
        setMatchesError(zh ? "成绩加载失败" : "Could not load match results");
        return;
      }
      const data = (await res.json()) as {
        confirmed?: MatchScoreRow[];
        empty?: boolean;
      };
      const rows = Array.isArray(data.confirmed) ? data.confirmed : [];
      // Newest first (API already unshifts new scores; keep confirmed only).
      const sorted = [...rows].sort((a, b) => {
        const da = String(a.confirmedAt || a.createdAt || "");
        const db = String(b.confirmedAt || b.createdAt || "");
        return db.localeCompare(da);
      });
      setConfirmedMatches(sorted);
    } catch {
      setConfirmedMatches([]);
      setMatchesError(zh ? "成绩加载失败" : "Could not load match results");
    } finally {
      setMatchesLoading(false);
    }
  }, [isCoach, zh]);

  useEffect(() => {
    if (mainTab !== "matches" || isCoach) return;
    void loadMatchHistory();
  }, [mainTab, isCoach, loadMatchHistory]);

  function selectMainTab(tab: ProfileTab) {
    setMainTab(tab);
    writeProfileTab(tab);
  }

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

  async function saveCity(next: string) {
    if (!cityOptions.some((c) => c.id === next)) return;
    setCityId(next);
    persistCityId(next);
    setSavingCity(true);
    setCityNote("");
    try {
      const res = await fetch("/tennis/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: next }),
      });
      const data = (await res.json()) as { error?: string; cityId?: string };
      if (!res.ok) {
        setCityNote(data.error || (zh ? "城市保存失败" : "Could not save city"));
        return;
      }
      await refreshSessionProfile();
      const saved = String(data.cityId || next);
      setCityId(saved);
      persistCityId(saved);
      try {
        window.localStorage.setItem(CITY_STORAGE_KEY, saved);
      } catch {
        /* ignore */
      }
      const label = cityLabel(getCity(saved) || { id: saved, zh: saved, en: saved, countryCode: "", aliases: [] }, locale);
      setCityNote(zh ? `当前位置已设为${label}` : `Location set to ${label}`);
    } catch {
      setCityNote(zh ? "城市保存失败" : "Could not save city");
    } finally {
      setSavingCity(false);
    }
  }

  const shownName =
    (session.displayName || nameDraft || "").trim() ||
    (zh ? "未设置显示名" : "No display name yet");
  const city = getCity(cityId);
  const cityName = city ? cityLabel(city, locale) : cityId;
  const selfNorm = normName(session.displayName || nameDraft || "");

  const mainTabs: { id: ProfileTab; label: string }[] = [
    { id: "overview", label: t("profile.tabOverview") },
    { id: "matches", label: t("profile.tabMatches") },
  ];

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-4" data-profile-page="true">
      <section
        id="profile-card"
        className="rounded-lg bg-gradient-to-br from-primary to-primary-hover p-5 text-primary-foreground"
        data-profile-city={cityId}
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
                {typeof session.level === "number"
                  ? zh
                    ? `水平 ${session.level.toFixed(1)}`
                    : `Level ${session.level.toFixed(1)}`
                  : zh
                    ? "水平未设"
                    : "Level unset"}
              </span>
              <RoleBadge />
            </div>
            <p className="mt-1 truncate text-xs opacity-90">
              {session.phone ? session.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2") : t("profile.bio")}
            </p>
            <p
              className="mt-1 flex items-center gap-1 truncate text-xs opacity-90"
              data-profile-city-label="true"
            >
              <MapPin className="size-3 shrink-0 opacity-90" />
              <span>
                {zh ? "当前位置" : "Location"} · {cityReady ? cityName : "…"}
              </span>
            </p>
          </div>
        </div>
        {mainTab === "overview" ? (
          <>
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
            <div className="mt-3 space-y-2 rounded-md bg-primary-foreground/10 p-3" data-profile-city-editor="true">
              <label className="block text-[11px] opacity-90" htmlFor="profile-city-select">
                {zh ? "当前位置 / 城市（球友排行与匹配用）" : "Current location / city (friends ladder & matchmaking)"}
              </label>
              <select
                id="profile-city-select"
                data-profile-city-select="true"
                value={cityId}
                disabled={!cityReady || savingCity}
                onChange={(e) => void saveCity(e.target.value)}
                className="h-9 w-full rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-2.5 text-sm text-primary-foreground outline-none disabled:opacity-60"
              >
                {cityOptions.map((c) => (
                  <option key={c.id} value={c.id} className="text-foreground">
                    {cityLabel(c, locale)}
                  </option>
                ))}
              </select>
              {savingCity ? (
                <p className="text-[11px] opacity-80" data-profile-city-saving="true">
                  {zh ? "保存中…" : "Saving…"}
                </p>
              ) : null}
              {cityNote ? (
                <p className="text-[11px] opacity-90" data-profile-city-note="true">
                  {cityNote}
                </p>
              ) : (
                <p className="text-[11px] opacity-80">
                  {zh
                    ? "中文版仅中国城市；改城后本地排行与匹配会按新城市过滤。"
                    : "Chinese UI lists China cities; English includes world cities. Ladder & matchmaking follow this city."}
                </p>
              )}
            </div>
          </>
        ) : null}
      </section>

      {!isCoach ? (
        <div
          className="flex gap-2"
          data-profile-main-tabs="true"
          role="tablist"
          aria-label={t("profile.mainTabsAria")}
        >
          {mainTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mainTab === item.id}
              data-profile-main-tab-btn={item.id}
              data-profile-main-tab-selected={mainTab === item.id ? "true" : undefined}
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
      ) : null}

      {mainTab === "overview" || isCoach ? (
        <>
          <section id="my-data" className={isCoach ? "hidden" : "space-y-3"} data-profile-panel="overview">
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
              <AndroidApkLink
                variant="row"
                className={menus.length > 0 ? "border-t border-border" : undefined}
              />
            </div>
            <LogoutButton />
          </section>
        </>
      ) : (
        <section
          id="match-history"
          className="space-y-3"
          data-profile-panel="matches"
          data-profile-match-history="true"
        >
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{t("profile.matchHistoryTitle")}</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("profile.matchHistoryLead")}</p>
          </div>

          {matchesLoading ? <LoadingState label={t("profile.matchHistoryLoading")} /> : null}

          {!matchesLoading && matchesError ? (
            <EmptyState title={t("profile.matchHistoryError")} description={matchesError}>
              <button
                type="button"
                data-profile-match-retry="true"
                onClick={() => void loadMatchHistory()}
                className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                {t("profile.matchHistoryRetry")}
              </button>
            </EmptyState>
          ) : null}

          {!matchesLoading && !matchesError && confirmedMatches.length === 0 ? (
            <EmptyState
              title={t("profile.matchHistoryEmpty")}
              description={t("profile.matchHistoryEmptyDesc")}
            />
          ) : null}

          {!matchesLoading && !matchesError && confirmedMatches.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card" data-profile-match-list="true">
              {confirmedMatches.map((row, index) => {
                const winnerName = row.winner === "A" ? row.playerA : row.playerB;
                const date = String(row.confirmedAt || row.createdAt || "").slice(0, 10);
                const iAmA = selfNorm && selfNorm === normName(row.playerA);
                const iAmB = selfNorm && selfNorm === normName(row.playerB);
                const iWon =
                  (iAmA && row.winner === "A") || (iAmB && row.winner === "B")
                    ? true
                    : (iAmA || iAmB) && ((iAmA && row.winner === "B") || (iAmB && row.winner === "A"))
                      ? false
                      : null;
                const resultLabel =
                  iWon === true
                    ? t("profile.matchResultWin")
                    : iWon === false
                      ? t("profile.matchResultLoss")
                      : t("friends.winnerLine", { name: winnerName });
                const opponent =
                  iAmA ? row.playerB : iAmB ? row.playerA : `${row.playerA} vs ${row.playerB}`;
                return (
                  <div
                    key={row.id}
                    data-profile-match-row={row.id}
                    data-profile-match-result={iWon === true ? "win" : iWon === false ? "loss" : "other"}
                    className={cn(
                      "flex items-start justify-between gap-3 px-4 py-3",
                      index === confirmedMatches.length - 1 ? "" : "border-b border-border",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {iAmA || iAmB ? (
                          <>
                            <span className="text-muted-foreground">{t("profile.matchVs")} </span>
                            {opponent}
                          </>
                        ) : (
                          opponent
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatSets(row.sets)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        <span
                          className={cn(
                            "font-semibold",
                            iWon === true ? "text-primary" : iWon === false ? "text-destructive" : "",
                          )}
                        >
                          {resultLabel}
                        </span>
                        {" · "}
                        {t("friends.scoreStatusConfirmed")}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{date}</p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
