"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { pageClass } from "@/lib/data";
import { rateLadder, type LadderFormat, type LadderRow } from "@/lib/local-ladder";
import {
  CITY_STORAGE_KEY,
  DEFAULT_CITY_ID,
  citiesForLocale,
  cityLabel,
  getCity,
  loadStoredCityId,
  matchCityFromGeo,
  persistCityId,
  type City,
} from "@/lib/cities";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

const FORMATS: LadderFormat[] = ["singles", "doubles"];
const SCORE_KEY = "zq-match-scores-v1";

type SavedMatch = {
  id: string;
  savedAt: string;
  playerA: string;
  playerB: string;
  sets: [number, number][];
  winner: "A" | "B";
};

function loadScores(): SavedMatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistScores(rows: SavedMatch[]) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

function parseSetPair(a: string, b: string): [number, number] | null {
  const ga = Number(a);
  const gb = Number(b);
  if (!Number.isFinite(ga) || !Number.isFinite(gb)) return null;
  if (ga < 0 || gb < 0 || ga > 99 || gb > 99) return null;
  if (ga === 0 && gb === 0) return null;
  return [Math.floor(ga), Math.floor(gb)];
}

function winnerFromSets(sets: [number, number][]): "A" | "B" | null {
  let wa = 0;
  let wb = 0;
  for (const [a, b] of sets) {
    if (a === b) continue;
    if (a > b) wa += 1;
    else wb += 1;
  }
  if (wa === wb) return null;
  return wa > wb ? "A" : "B";
}

function formatSets(sets: [number, number][]): string {
  return sets.map(([a, b]) => `${a}-${b}`).join(" · ");
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
      // EN can take any catalog match even if zh-limited pool missed it via cityId
      if (!locale.toLowerCase().startsWith("zh") && matched) return matched.id;
    }
  } catch {
    /* fall through */
  }
  // zh: prefer Wuxi; en: same default if IP unknown
  if (pool.some((c) => c.id === DEFAULT_CITY_ID)) return DEFAULT_CITY_ID;
  return pool[0]?.id || DEFAULT_CITY_ID;
}

export function FriendsView() {
  const { t, locale } = useI18n();
  const [format, setFormat] = useState<LadderFormat>("singles");
  const cityOptions = useMemo(() => citiesForLocale(locale), [locale]);

  const [cityId, setCityId] = useState<string>(DEFAULT_CITY_ID);
  const [citySource, setCitySource] = useState<"ip" | "manual" | "default">("default");
  const [cityReady, setCityReady] = useState(false);

  const ladder = useMemo(() => rateLadder(format, undefined, undefined, undefined, cityId), [format, cityId]);
  const city = getCity(cityId);
  const cityName = city ? cityLabel(city, locale) : cityId;

  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [setLines, setSetLines] = useState([
    { a: "", b: "" },
    { a: "", b: "" },
    { a: "", b: "" },
  ]);
  const [history, setHistory] = useState<SavedMatch[]>([]);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setHistory(loadScores());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadStoredCityId();
      if (stored && cityOptions.some((c) => c.id === stored)) {
        if (!cancelled) {
          setCityId(stored);
          setCitySource("manual");
          setCityReady(true);
        }
        return;
      }
      const detected = await detectCityFromIp(locale);
      if (!cancelled) {
        setCityId(detected);
        setCitySource(detected ? "ip" : "default");
        setCityReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, cityOptions]);

  // If locale flips to zh and current city is outside China list, snap to default.
  useEffect(() => {
    if (!cityOptions.some((c) => c.id === cityId)) {
      const next = cityOptions.some((c) => c.id === DEFAULT_CITY_ID)
        ? DEFAULT_CITY_ID
        : cityOptions[0]?.id || DEFAULT_CITY_ID;
      setCityId(next);
    }
  }, [cityOptions, cityId]);

  function onPickCity(next: string) {
    setCityId(next);
    setCitySource("manual");
    persistCityId(next);
  }

  function updateSetLine(index: number, side: "a" | "b", value: string) {
    const cleaned = value.replace(/[^\d]/g, "").slice(0, 2);
    setSetLines((prev) => prev.map((row, i) => (i === index ? { ...row, [side]: cleaned } : row)));
  }

  function onSaveScore() {
    const aName = playerA.trim();
    const bName = playerB.trim();
    if (!aName || !bName) {
      setFormError(t("friends.scoreNeedNames"));
      return;
    }
    if (aName === bName) {
      setFormError(t("friends.scoreDistinctNames"));
      return;
    }
    const sets: [number, number][] = [];
    for (const line of setLines) {
      if (!line.a && !line.b) continue;
      const pair = parseSetPair(line.a, line.b);
      if (!pair) {
        setFormError(t("friends.scoreBadSets"));
        return;
      }
      sets.push(pair);
    }
    if (!sets.length) {
      setFormError(t("friends.scoreNeedSets"));
      return;
    }
    const winner = winnerFromSets(sets);
    if (!winner) {
      setFormError(t("friends.scoreNeedWinner"));
      return;
    }
    const row: SavedMatch = {
      id: `s-${Date.now()}`,
      savedAt: new Date().toISOString(),
      playerA: aName,
      playerB: bName,
      sets,
      winner,
    };
    const next = [row, ...history].slice(0, 40);
    setHistory(next);
    persistScores(next);
    setPlayerA("");
    setPlayerB("");
    setSetLines([
      { a: "", b: "" },
      { a: "", b: "" },
      { a: "", b: "" },
    ]);
    setFormError("");
  }

  function onClearHistory() {
    setHistory([]);
    persistScores([]);
  }

  return (
    <div className={pageClass} data-page="friends" data-friends-city={cityId}>
      <div>
        <h1 className="text-base font-bold text-foreground">{t("friends.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {cityReady
            ? t("friends.cityCount", { n: ladder.length, city: cityName })
            : t("friends.cityDetecting")}
        </p>
      </div>

      <section className="space-y-2" data-city-scope="true">
        <div className="flex items-end justify-between gap-3">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">{t("friends.cityLabel")}</span>
            <select
              data-city-select="true"
              value={cityId}
              onChange={(e) => onPickCity(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={t("friends.cityLabel")}
            >
              {cityOptions.map((c: City) => (
                <option key={c.id} value={c.id}>
                  {cityLabel(c, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground" data-city-source={citySource}>
          {citySource === "manual"
            ? t("friends.cityManualHint", { city: cityName })
            : citySource === "ip"
              ? t("friends.cityIpHint", { city: cityName })
              : t("friends.cityDefaultHint", { city: cityName })}
        </p>
      </section>

      <section className="space-y-3" data-score-entry="true">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("friends.scoreTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("friends.scoreLead")}</p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">{t("friends.playerA")}</span>
              <input
                data-score-player="a"
                value={playerA}
                onChange={(e) => setPlayerA(e.target.value)}
                placeholder={t("friends.playerAPh")}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">{t("friends.playerB")}</span>
              <input
                data-score-player="b"
                value={playerB}
                onChange={(e) => setPlayerB(e.target.value)}
                placeholder={t("friends.playerBPh")}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">{t("friends.setScores")}</p>
            {setLines.map((line, index) => (
              <div key={index} className="flex items-center gap-2" data-score-set={index + 1}>
                <span className="w-10 shrink-0 text-[11px] text-muted-foreground">
                  {t("friends.setN", { n: index + 1 })}
                </span>
                <input
                  inputMode="numeric"
                  value={line.a}
                  onChange={(e) => updateSetLine(index, "a", e.target.value)}
                  aria-label={t("friends.setGamesA", { n: index + 1 })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="6"
                />
                <span className="text-sm text-muted-foreground">–</span>
                <input
                  inputMode="numeric"
                  value={line.b}
                  onChange={(e) => updateSetLine(index, "b", e.target.value)}
                  aria-label={t("friends.setGamesB", { n: index + 1 })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="4"
                />
              </div>
            ))}
          </div>
          {formError ? (
            <p className="text-xs text-destructive" data-score-error="true">
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            data-score-save="true"
            onClick={onSaveScore}
            className="h-9 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            {t("friends.saveScore")}
          </button>
        </div>

        <div className="space-y-2" data-score-history="true">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t("friends.scoreHistory")}</h3>
            {history.length > 0 ? (
              <button
                type="button"
                onClick={onClearHistory}
                className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                {t("friends.clearScores")}
              </button>
            ) : null}
          </div>
          {history.length === 0 ? (
            <EmptyState title={t("friends.scoreEmpty")} description={t("friends.scoreEmptyDesc")} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {history.map((row, index) => {
                const winnerName = row.winner === "A" ? row.playerA : row.playerB;
                return (
                  <div
                    key={row.id}
                    data-score-row={row.id}
                    className={cn(
                      "flex items-start justify-between gap-3 px-4 py-3",
                      index === history.length - 1 ? "" : "border-b border-border",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.playerA} vs {row.playerB}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatSets(row.sets)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t("friends.winnerLine", { name: winnerName })}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {row.savedAt.slice(0, 10)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3" data-ladder={format} data-ladder-city={cityId}>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("friends.rankTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("friends.rankLeadCity", { city: cityName })}
          </p>
        </div>
        <div className="flex gap-2" data-ladder-toggle="true" role="tablist" aria-label={t("friends.rankTitle")}>
          {FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={format === item}
              data-ladder-format={item}
              data-ladder-selected={format === item ? "true" : undefined}
              onClick={() => setFormat(item)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold",
                format === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {t(`friends.${item}`)}
            </button>
          ))}
        </div>
        {ladder.length === 0 ? (
          <EmptyState title={t("friends.emptyRank")} description={t("friends.emptyRankCity", { city: cityName })} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {ladder.map((row, index) => (
              <LadderRowView key={row.id} row={row} last={index === ladder.length - 1} />
            ))}
          </div>
        )}
        <p className="text-[11px] leading-5 text-muted-foreground">{t("friends.howBodyCity")}</p>
      </section>
    </div>
  );
}

function LadderRowView({ row, last }: { row: LadderRow; last: boolean }) {
  const { t } = useI18n();
  const form = row.played
    ? t("friends.form", { w: row.wins, l: row.losses })
    : t("friends.seedOnly", { n: row.seed.toFixed(1) });
  const lastLine =
    row.lastResult && row.lastOpponentName
      ? t(row.lastResult === "win" ? "friends.beat" : "friends.lost", { name: row.lastOpponentName })
      : "";
  return (
    <div
      data-ladder-row={row.id}
      data-ladder-rank={row.rank}
      data-ladder-city={row.cityId}
      className={cn("flex items-start gap-3 px-4 py-3", last ? "" : "border-b border-border")}
    >
      <p className="w-6 shrink-0 text-sm font-bold text-primary">{row.rank}</p>
      <Avatar className="size-10">
        <AvatarFallback className="bg-primary-subtle text-sm font-semibold text-primary">
          {row.name.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="shrink-0 text-sm font-bold text-foreground" data-ladder-rating={row.rating}>
            {row.rating.toFixed(1)}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {form}
          {lastLine ? ` · ${lastLine}` : ""}
        </p>
      </div>
    </div>
  );
}

// Keep storage key export reference so tree-shaking does not drop cities module side usage in patches.
void CITY_STORAGE_KEY;
