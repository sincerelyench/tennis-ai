"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { pageClass } from "@/lib/data";
import { rateLadder, utrSeedFromSelfLevel, playersFromDirectory, ensureSelfInPlayers, type LadderFormat, type LadderPlayer, type LadderRow } from "@/lib/local-ladder";
import { useSessionRole } from "@/lib/session-role";
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
import {
  LEVEL_OPTIONS,
  loadSelfLevel,
  loadSelfName,
  matchSearchMs,
  persistSelfLevel,
  persistSelfName,
  pickBestMatch,
  type MatchCandidate,
  type MatchPhase,
} from "@/lib/matchmaking";
import { useI18n } from "@/components/i18n-provider";
import { RatingHelpTip } from "@/components/rating-help-tip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FORMATS: LadderFormat[] = ["singles", "doubles"];
const SCORE_KEY = "zq-match-scores-v1";
const INTRO_KEY = "zq-match-intros-v1";

type IntroStatus = "awaiting_accept" | "pending" | "replied" | "cancelled";

type MatchCommentPublic = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type MatchIntroRow = {
  id: string;
  kind: "match" | "challenge";
  status: IntroStatus;
  fromName: string;
  toName: string;
  buddyId: string;
  body: string;
  canCancel?: boolean;
  needsAccept?: boolean;
  iAmTarget?: boolean;
  iAmFrom?: boolean;
  awaitingOther?: boolean;
  matchSuccess?: boolean;
  acceptedAt?: string | null;
  acceptedUnread?: boolean;
  fromNotify?: boolean;
  opponentName?: string;
  opponentWechat?: string | null;
  /** Server-attached confirmed score between the pair (optional). */
  linkedScore?: {
    id: string;
    createdAt?: string;
    confirmedAt?: string | null;
    playerA: string;
    playerB: string;
    sets: [number, number][];
    winner: "A" | "B";
    status?: ScoreStatus;
    opponentName?: string;
    needsConfirm?: boolean;
    description?: string;
    highlightUrl?: string;
    highlightName?: string;
    comments?: MatchCommentPublic[];
    commentCount?: number;
    submitterHideFromPublic?: boolean;
    opponentHideFromPublic?: boolean;
    hideFromPublicFeed?: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "server" | "local";
};

type ScoreStatus = "pending" | "confirmed" | "rejected";

type SavedMatch = {
  id: string;
  savedAt: string;
  playerA: string;
  playerB: string;
  sets: [number, number][];
  winner: "A" | "B";
  status?: ScoreStatus;
  opponentName?: string;
  needsConfirm?: boolean;
  source?: "server" | "local";
  description?: string;
  highlightUrl?: string;
  highlightName?: string;
  comments?: MatchCommentPublic[];
  commentCount?: number;
  submitterHideFromPublic?: boolean;
  opponentHideFromPublic?: boolean;
  hideFromPublicFeed?: boolean;
};

type LadderApiRow = LadderRow;

function loadLocalScores(): SavedMatch[] {
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

function persistLocalScores(rows: SavedMatch[]) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* ignore quota */
  }
}

function mapApiScore(row: {
  id: string;
  createdAt?: string;
  confirmedAt?: string | null;
  playerA: string;
  playerB: string;
  sets: [number, number][];
  winner: "A" | "B";
  status?: ScoreStatus;
  opponentName?: string;
  needsConfirm?: boolean;
  description?: string;
  highlightUrl?: string;
  highlightName?: string;
  comments?: MatchCommentPublic[];
  commentCount?: number;
  submitterHideFromPublic?: boolean;
  opponentHideFromPublic?: boolean;
  hideFromPublicFeed?: boolean;
}): SavedMatch {
  const comments = Array.isArray(row.comments) ? row.comments : [];
  return {
    id: row.id,
    savedAt: row.confirmedAt || row.createdAt || new Date().toISOString(),
    playerA: row.playerA,
    playerB: row.playerB,
    sets: row.sets,
    winner: row.winner,
    status: row.status || "pending",
    opponentName: row.opponentName,
    needsConfirm: Boolean(row.needsConfirm),
    source: "server",
    description: String(row.description || ""),
    highlightUrl: String(row.highlightUrl || ""),
    highlightName: String(row.highlightName || ""),
    comments,
    commentCount: typeof row.commentCount === "number" ? row.commentCount : comments.length,
    submitterHideFromPublic: row.submitterHideFromPublic === true,
    opponentHideFromPublic: row.opponentHideFromPublic === true,
    hideFromPublicFeed: row.hideFromPublicFeed === true,
  };
}

/** 展示/隐藏 segmented control for score privacy (default 展示). */
function ScorePrivacyToggle({
  valueHide,
  onChange,
  label,
  hint,
  testId,
}: {
  valueHide: boolean;
  onChange: (hide: boolean) => void;
  label: string;
  hint: string;
  testId: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5" data-score-privacy={testId}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={label}>
        <button
          type="button"
          data-score-privacy-show={testId}
          aria-pressed={!valueHide}
          onClick={() => onChange(false)}
          className={cn(
            "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
            !valueHide
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground",
          )}
        >
          {t("friends.scorePrivacyShow")}
        </button>
        <button
          type="button"
          data-score-privacy-hide={testId}
          aria-pressed={valueHide}
          onClick={() => onChange(true)}
          className={cn(
            "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
            valueHide
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground",
          )}
        >
          {t("friends.scorePrivacyHide")}
        </button>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function isHighlightVideoUrl(url: string) {
  return (
    /\.(mp4|webm|mov)(\?|$)/i.test(url) ||
    url.includes("/match-highlights/") ||
    url.includes("/coach-demos/")
  );
}

function MatchMedia({ url, name }: { url: string; name?: string }) {
  const { t } = useI18n();
  if (!url) return null;
  if (isHighlightVideoUrl(url)) {
    return (
      <video
        className="max-h-56 w-full rounded-md bg-black"
        src={url}
        controls
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {name || t("friends.highlightOpenLink")}
    </a>
  );
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

function normName(value: string | undefined | null): string {
  return String(value || "").trim().toLowerCase();
}

/** 约球成功行：用对手名匹配已录比分（排除已拒绝），优先已确认、再待确认、再最新。 */
function findScoreForOpponent(opponent: string, scores: SavedMatch[]): SavedMatch | undefined {
  const o = normName(opponent);
  if (!o) return undefined;
  const candidates = scores.filter((s) => {
    if (s.status === "rejected") return false;
    return (
      normName(s.opponentName) === o ||
      normName(s.playerA) === o ||
      normName(s.playerB) === o
    );
  });
  if (candidates.length === 0) return undefined;
  const rank = (s: SavedMatch) => (s.status === "confirmed" || !s.status ? 0 : s.status === "pending" ? 1 : 2);
  candidates.sort((a, b) => rank(a) - rank(b) || b.savedAt.localeCompare(a.savedAt));
  return candidates[0];
}

function successSortTs(row: MatchIntroRow): string {
  return String(row.acceptedAt || row.updatedAt || row.createdAt || "");
}

/** 严格跟库：API 已按真实成功 intro 返回，前端不再按对手折叠。 */
function orderSuccessRecords(rows: MatchIntroRow[]): MatchIntroRow[] {
  return [...rows].sort((a, b) => successSortTs(b).localeCompare(successSortTs(a)));
}

function formatSets(sets: [number, number][]): string {
  return sets.map(([a, b]) => `${a}-${b}`).join(" · ");
}

function loadLocalIntros(): MatchIntroRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INTRO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLocalIntros(rows: MatchIntroRow[]) {
  try {
    localStorage.setItem(INTRO_KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

function introBodyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("zh")
    ? "匹配成功，请互相加微信，再自行约定场地和时间。"
    : "Match successful. Please add each other on WeChat, then arrange the venue and time yourselves.";
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

export function FriendsView() {
  const { t, locale } = useI18n();
  const session = useSessionRole();
  const [format, setFormat] = useState<LadderFormat>("singles");
  const cityOptions = useMemo(() => citiesForLocale(locale), [locale]);

  const [cityId, setCityId] = useState<string>(DEFAULT_CITY_ID);
  const [citySource, setCitySource] = useState<"ip" | "manual" | "default">("default");
  const [cityReady, setCityReady] = useState(false);
  const [directoryPlayers, setDirectoryPlayers] = useState<LadderPlayer[]>([]);
  const [directoryCount, setDirectoryCount] = useState(0);
  const [ladderRows, setLadderRows] = useState<LadderApiRow[]>([]);
  const [ladderFromApi, setLadderFromApi] = useState(false);
  const [pendingForMe, setPendingForMe] = useState<SavedMatch[]>([]);
  const [minePending, setMinePending] = useState<SavedMatch[]>([]);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [scoreNotice, setScoreNotice] = useState("");

  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [setLines, setSetLines] = useState([
    { a: "", b: "" },
    { a: "", b: "" },
    { a: "", b: "" },
  ]);
  const [history, setHistory] = useState<SavedMatch[]>([]);
  const [formError, setFormError] = useState("");

  const [selfName, setSelfName] = useState("");
  const [selfLevel, setSelfLevel] = useState(3.5);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("idle");
  const [matchHintIdx, setMatchHintIdx] = useState(0);
  const [matched, setMatched] = useState<MatchCandidate | null>(null);
  const [recentMatchIds, setRecentMatchIds] = useState<string[]>([]);
  const [activeIntro, setActiveIntro] = useState<MatchIntroRow | null>(null);
  const [introInbox, setIntroInbox] = useState<MatchIntroRow[]>([]);
  const [sentPending, setSentPending] = useState<MatchIntroRow[]>([]);
  const [successRecords, setSuccessRecords] = useState<MatchIntroRow[]>([]);
  const [introBusy, setIntroBusy] = useState(false);
  const [challengeQuery, setChallengeQuery] = useState("");
  const [friendsMainTab, setFriendsMainTab] = useState<"match" | "ladder">("match");
  /** 录入比分表单默认收起，点「录入比分 / 去录入比分」后再展开 */
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  /** false = 展示 (default); true = 隐藏 from ladder city feed */
  const [scoreHideFromPublic, setScoreHideFromPublic] = useState(false);
  /** Per pending-inbox row: opponent hide choice at confirm (default 展示) */
  const [confirmHideById, setConfirmHideById] = useState<Record<string, boolean>>({});
  const [scoreDescDraft, setScoreDescDraft] = useState("");
  const [scoreHighlightFile, setScoreHighlightFile] = useState<File | null>(null);
  const scoreHighlightFileRef = useRef<HTMLInputElement | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusyId, setCommentBusyId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});
  const [highlightNotice, setHighlightNotice] = useState("");
  const [ladderDetail, setLadderDetail] = useState<{
    id: string;
    name: string;
    rank: number;
    rating: number;
    played: boolean;
  } | null>(null);
  const [ladderDetailMatches, setLadderDetailMatches] = useState<
    {
      id: string;
      date: string;
      opponentName: string;
      result: "win" | "loss";
      sets: [number, number][];
      ratingDelta?: number;
      excluded?: boolean;
      softExcluded?: boolean;
      description?: string;
      highlightUrl?: string;
      highlightName?: string;
      comments?: MatchCommentPublic[];
      commentCount?: number;
    }[]
  >([]);
  const [ladderDetailBusy, setLadderDetailBusy] = useState(false);
  /** ZQ-139: target profile 战绩可见=不可见 → hide recent section for others. */
  const [ladderDetailHistoryHidden, setLadderDetailHistoryHidden] = useState(false);
  const [cityMatches, setCityMatches] = useState<SavedMatch[]>([]);
  const [cityMatchDetail, setCityMatchDetail] = useState<SavedMatch | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 仅对方待应战的新邀请；约球成功后不再出现在邀请列表 */
  function isOpenInvite(row: MatchIntroRow) {
    if (row.status !== "awaiting_accept") return false;
    if (row.awaitingOther || row.iAmFrom === true) return false;
    return Boolean(row.needsAccept) || row.iAmTarget === true;
  }

  /** 我发出、对方尚未应战；进约球成功后离开此列表 */
  function isSentPendingInvite(row: MatchIntroRow) {
    if (row.status !== "awaiting_accept") return false;
    if (row.awaitingOther === true) return true;
    if (row.iAmFrom === true && row.iAmTarget !== true) return true;
    return false;
  }

  const selfUtr = useMemo(() => utrSeedFromSelfLevel(selfLevel), [selfLevel]);

  const ladderPlayers = useMemo(() => {
    const name = selfName.trim() || String(session.displayName || "").trim();
    return ensureSelfInPlayers(directoryPlayers, {
      id: session.phone,
      phone: session.phone,
      name,
      level: selfLevel,
      cityId,
    });
  }, [directoryPlayers, selfName, selfLevel, cityId, session.phone, session.displayName]);

  const clientLadder = useMemo(
    () => rateLadder(format, new Date(), ladderPlayers, [], cityId),
    [format, cityId, ladderPlayers],
  );

  const ladder = useMemo(() => {
    if (!ladderFromApi) return clientLadder;
    const name = selfName.trim() || String(session.displayName || "").trim();
    if (!name || !cityId) return ladderRows;
    const selfId = session.phone || `self:${name}`;
    if (ladderRows.some((r) => r.id === selfId || r.name === name)) return ladderRows;
    // API city filter lagged behind selected city — still show self locally.
    const seed = utrSeedFromSelfLevel(selfLevel);
    const merged: LadderApiRow[] = [
      ...ladderRows,
      {
        id: selfId,
        name,
        cityId,
        placeKey: "",
        strokes: [],
        rank: 0,
        rating: seed,
        seed,
        wins: 0,
        losses: 0,
        played: false,
        qualifiedMatches: 0,
        projected: true,
        ntrp: selfLevel,
        lastOpponentName: "",
        lastResult: undefined,
      },
    ];
    merged.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
    merged.forEach((r, i) => {
      r.rank = i + 1;
    });
    return merged;
  }, [
    ladderFromApi,
    ladderRows,
    clientLadder,
    selfName,
    session.displayName,
    session.phone,
    cityId,
    selfLevel,
  ]);
  const city = getCity(cityId);
  const cityName = city ? cityLabel(city, locale) : cityId;

  async function refreshDirectory() {
    try {
      const res = await fetch("/tennis/api/friends/directory?role=player&includeSelf=1", {
        credentials: "include",
      });
      if (!res.ok) {
        setDirectoryPlayers([]);
        setDirectoryCount(0);
        return;
      }
      const data = (await res.json()) as {
        users?: { id: string; displayName: string; cityId?: string; level?: number }[];
        count?: number;
        self?: { displayName?: string; cityId?: string; level?: number | null };
      };
      const users = Array.isArray(data.users) ? data.users : [];
      const players = playersFromDirectory(users);
      setDirectoryPlayers(players);
      setDirectoryCount(typeof data.count === "number" ? data.count : players.length);
      const dn = String(data.self?.displayName || session.displayName || "").trim();
      if (dn) {
        setSelfName(dn);
        persistSelfName(dn);
        setPlayerA((prev) => prev || dn);
      }
      if (typeof data.self?.level === "number") {
        setSelfLevel(data.self.level);
        persistSelfLevel(data.self.level);
      }
    } catch {
      setDirectoryPlayers([]);
      setDirectoryCount(0);
    }
  }

  async function refreshLadder() {
    try {
      const q = new URLSearchParams({ format, cityId: cityId || "" });
      const res = await fetch(`/tennis/api/friends/ladder?${q}`, { credentials: "include" });
      if (!res.ok) {
        setLadderFromApi(false);
        return;
      }
      const data = (await res.json()) as {
        rows?: LadderApiRow[];
        count?: number;
        empty?: boolean;
      };
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setLadderRows(rows);
      setLadderFromApi(true);
      if (typeof data.count === "number" && data.count === 0) {
        /* empty = 0 — keep rows [] */
      }
    } catch {
      setLadderFromApi(false);
    }
  }

  async function refreshScores() {
    try {
      const res = await fetch("/tennis/api/friends/scores", { credentials: "include" });
      if (!res.ok) {
        setHistory(loadLocalScores());
        setPendingForMe([]);
        setMinePending([]);
        return;
      }
      const data = (await res.json()) as {
        pendingForMe?: Parameters<typeof mapApiScore>[0][];
        minePending?: Parameters<typeof mapApiScore>[0][];
        confirmed?: Parameters<typeof mapApiScore>[0][];
      };
      const pending = (data.pendingForMe || []).map(mapApiScore);
      const mine = (data.minePending || []).map(mapApiScore);
      const confirmed = (data.confirmed || []).map(mapApiScore);
      setPendingForMe(pending);
      setMinePending(mine);
      const merged = [...pending, ...mine, ...confirmed];
      setHistory(merged);
      persistLocalScores(merged);
    } catch {
      setHistory(loadLocalScores());
    }
  }

  async function refreshCityMatches() {
    if (!cityReady || !cityId) {
      setCityMatches([]);
      return;
    }
    try {
      const q = new URLSearchParams({
        scope: "city",
        cityId,
        format,
      });
      const res = await fetch(`/tennis/api/friends/scores?${q}`, { credentials: "include" });
      if (!res.ok) {
        setCityMatches([]);
        return;
      }
      const data = (await res.json()) as {
        matches?: Parameters<typeof mapApiScore>[0][];
      };
      setCityMatches((Array.isArray(data.matches) ? data.matches : []).map(mapApiScore));
    } catch {
      setCityMatches([]);
    }
  }

  function patchScoreInHistory(next: SavedMatch) {
    const apply = (rows: SavedMatch[]) => rows.map((r) => (r.id === next.id ? { ...r, ...next } : r));
    setHistory((prev) => {
      const merged = apply(prev);
      persistLocalScores(merged);
      return merged;
    });
    setPendingForMe((prev) => apply(prev));
    setMinePending((prev) => apply(prev));
    setCityMatches((prev) => apply(prev));
    setCityMatchDetail((prev) => (prev && prev.id === next.id ? { ...prev, ...next } : prev));
    setLadderDetailMatches((prev) =>
      prev.map((m) =>
        m.id === next.id
          ? {
              ...m,
              description: next.description,
              highlightUrl: next.highlightUrl,
              highlightName: next.highlightName,
              comments: next.comments,
              commentCount: next.commentCount,
            }
          : m,
      ),
    );
  }

  async function submitComment(scoreId: string) {
    const body = String(commentDrafts[scoreId] || "").trim();
    if (!body) return;
    setCommentBusyId(scoreId);
    setHighlightNotice("");
    try {
      const res = await fetch(`/tennis/api/friends/scores/${encodeURIComponent(scoreId)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        score?: Parameters<typeof mapApiScore>[0];
      };
      if (!res.ok || !data.score) {
        setHighlightNotice(data.error || t("friends.commentFail"));
        return;
      }
      patchScoreInHistory(mapApiScore(data.score));
      setCommentDrafts((prev) => ({ ...prev, [scoreId]: "" }));
      setCommentsOpen((prev) => ({ ...prev, [scoreId]: true }));
    } catch {
      setHighlightNotice(t("friends.commentFail"));
    } finally {
      setCommentBusyId(null);
    }
  }

  async function removeComment(scoreId: string, commentId: string) {
    setCommentBusyId(scoreId);
    setHighlightNotice("");
    try {
      const res = await fetch(`/tennis/api/friends/scores/${encodeURIComponent(scoreId)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", commentId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        score?: Parameters<typeof mapApiScore>[0];
      };
      if (!res.ok || !data.score) {
        setHighlightNotice(data.error || t("friends.commentFail"));
        return;
      }
      patchScoreInHistory(mapApiScore(data.score));
    } catch {
      setHighlightNotice(t("friends.commentFail"));
    } finally {
      setCommentBusyId(null);
    }
  }

  useEffect(() => {
    setHistory(loadLocalScores());
    setSelfLevel(loadSelfLevel(session.level ?? 3.5));
    const authName = (session.displayName || "").trim() || loadSelfName("");
    setSelfName(authName);
    if (authName && !playerA) setPlayerA(authName);
  }, [session.displayName, session.level]);

  async function refreshIntros() {
    try {
      const res = await fetch("/tennis/api/friends/intros", {
        credentials: "include",
        headers: { "Accept-Language": locale === "zh" ? "zh-CN" : "en" },
      });
      if (!res.ok) {
        const local = loadLocalIntros();
        setIntroInbox(local.filter(isOpenInvite));
        setSentPending(local.filter(isSentPendingInvite));
        const active = local.find((row) => row.status === "pending" || row.status === "awaiting_accept") || null;
        setActiveIntro(active);
        setSuccessRecords(
          orderSuccessRecords(
            local.filter(
              (row) =>
                row.matchSuccess ||
                row.status === "pending" ||
                Boolean(row.acceptedAt),
            ),
          ),
        );
        return;
      }
      const data = (await res.json()) as {
        active?: MatchIntroRow[];
        inbox?: MatchIntroRow[];
        pendingAccept?: MatchIntroRow[];
        sentPending?: MatchIntroRow[];
        success?: MatchIntroRow[];
      };
      const activeRows = Array.isArray(data.active) ? data.active : [];
      const inbox = Array.isArray(data.inbox) ? data.inbox : [];
      const pendingAccept = Array.isArray(data.pendingAccept) ? data.pendingAccept : [];
      const sentFromApi = Array.isArray(data.sentPending) ? data.sentPending : [];
      const success = orderSuccessRecords(Array.isArray(data.success) ? data.success : []);
      const openInvites =
        pendingAccept.length > 0 ? pendingAccept.filter(isOpenInvite) : inbox.filter(isOpenInvite);
      setIntroInbox(openInvites);
      const sentRows =
        sentFromApi.length > 0
          ? sentFromApi.filter(isSentPendingInvite)
          : activeRows.filter(isSentPendingInvite);
      setSentPending(sentRows);
      const current = activeRows[0] || null;
      setActiveIntro(current);
      setSuccessRecords(success);
      persistLocalIntros([...activeRows, ...inbox, ...pendingAccept, ...sentRows, ...success]);
    } catch {
      const local = loadLocalIntros();
      setIntroInbox(local.filter(isOpenInvite));
      setSentPending(local.filter(isSentPendingInvite));
      setSuccessRecords(
        orderSuccessRecords(
          local.filter(
            (row) =>
              row.matchSuccess ||
              row.status === "pending" ||
              Boolean(row.acceptedAt),
          ),
        ),
      );
    }
  }

  async function openIntroWithBuddy(
    buddy: { id: string; name: string },
    kind: "match" | "challenge",
    openIntro: boolean,
  ) {
    const body = introBodyForLocale(locale);
    setIntroBusy(true);
    try {
      const res = await fetch("/tennis/api/friends/intros", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          kind,
          openIntro,
          toName: buddy.name,
          buddyId: buddy.id,
          cityId,
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { intro?: MatchIntroRow };
      if (res.ok && data.intro) {
        setActiveIntro(data.intro);
        setMatchPhase("found");
        await refreshIntros();
        setIntroBusy(false);
        return data.intro;
      }
    } catch {
      /* offline */
    }
    const local: MatchIntroRow = {
      id: `local-${Date.now()}`,
      kind,
      status: openIntro ? "pending" : "awaiting_accept",
      fromName: selfName.trim() || t("friends.matchYou"),
      toName: buddy.name,
      buddyId: buddy.id,
      body,
      canCancel: true,
      needsAccept: false,
      iAmFrom: true,
      iAmTarget: false,
      awaitingOther: !openIntro,
      matchSuccess: Boolean(openIntro),
      source: "local",
    };
    persistLocalIntros([local, ...loadLocalIntros().filter((row) => row.buddyId !== buddy.id)].slice(0, 40));
    setActiveIntro(local);
    setMatchPhase("found");
    setIntroBusy(false);
    return local;
  }

  async function onIntroAction(id: string, action: "cancel" | "accept" | "reply") {
    setIntroBusy(true);
    try {
      const res = await fetch("/tennis/api/friends/intros", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, locale }),
      });
      if (res.ok) {
        if (action === "cancel") {
          setActiveIntro(null);
          setMatched(null);
          setMatchPhase("postCancel");
        } else if (action === "accept") {
          setMatchPhase("found");
        }
        await refreshIntros();
        setIntroBusy(false);
        return;
      }
    } catch {
      /* local */
    }
    const rows = loadLocalIntros().map((row) => {
      if (row.id !== id) return row;
      if (action === "cancel") return { ...row, status: "cancelled" as const, canCancel: false, needsAccept: false };
      if (action === "accept")
        return {
          ...row,
          status: "pending" as const,
          needsAccept: false,
          canCancel: true,
          body: introBodyForLocale(locale),
        };
      return { ...row, status: "replied" as const, canCancel: false };
    });
    persistLocalIntros(rows);
    if (action === "cancel") {
      setActiveIntro(null);
      setMatched(null);
      setMatchPhase("postCancel");
    } else if (action === "accept") {
      setActiveIntro(rows.find((row) => row.id === id) || null);
      setMatchPhase("found");
    }
    setIntroInbox(rows.filter(isOpenInvite));
    setSentPending(rows.filter(isSentPendingInvite));
    setIntroBusy(false);
  }

  useEffect(() => {
    void refreshDirectory();
    void refreshScores();
    void refreshIntros();
  }, [session.displayName, cityOptions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#score-entry") return;
    setFriendsMainTab("match");
    setScoreFormOpen(true);
  }, []);

  useEffect(() => {
    if (!scoreFormOpen || typeof document === "undefined") return;
    const timer = window.setTimeout(() => {
      document.getElementById("score-entry")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const input = document.querySelector('[data-score-player="b"]') as HTMLInputElement | null;
      input?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [scoreFormOpen]);

  // 等待对方应战时轮询，应战后发起方约球页立刻切到成功态
  useEffect(() => {
    if (activeIntro?.status !== "awaiting_accept") return;
    const timer = window.setInterval(() => {
      void refreshIntros();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeIntro?.id, activeIntro?.status]);

  // 录入方等待对方确认时轮询：确认后排行榜 / 比赛结果 / UTR 即时刷新（服务端按确认场即时重放）
  useEffect(() => {
    if (minePending.length === 0 && pendingForMe.length === 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        await refreshScores();
        await Promise.all([refreshLadder(), refreshCityMatches()]);
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [minePending.length, pendingForMe.length, format, cityId, cityReady]);

  function goEnterScoreFromMatch(opponentName?: string) {
    setFriendsMainTab("match");
    setScoreFormOpen(true);
    const me = selfName.trim() || t("friends.matchYou");
    const other = (opponentName || matched?.name || activeIntro?.toName || "").trim();
    if (!playerA.trim()) setPlayerA(me);
    if (other) setPlayerB(other);
  }

  useEffect(() => {
    if (!cityReady) return;
    void refreshLadder();
    void refreshCityMatches();
  }, [format, cityId, cityReady, directoryCount]);


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

  useEffect(() => {
    if (!cityOptions.some((c) => c.id === cityId)) {
      const next = cityOptions.some((c) => c.id === DEFAULT_CITY_ID)
        ? DEFAULT_CITY_ID
        : cityOptions[0]?.id || DEFAULT_CITY_ID;
      setCityId(next);
    }
  }, [cityOptions, cityId]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (hintTimer.current) clearInterval(hintTimer.current);
    };
  }, []);


  async function saveAuthProfile(patch: { displayName?: string; cityId?: string; level?: number }) {
    try {
      await fetch("/tennis/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* ignore */
    }
  }

  function onPickCity(next: string) {
    setCityId(next);
    setCitySource("manual");
    persistCityId(next);
    void saveAuthProfile({ cityId: next });
  }

  function onPickLevel(next: number) {
    setSelfLevel(next);
    persistSelfLevel(next);
    void saveAuthProfile({ level: next });
  }

  function clearSearchTimers() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    if (hintTimer.current) {
      clearInterval(hintTimer.current);
      hintTimer.current = null;
    }
  }

  function startMatchmaking() {
    clearSearchTimers();
    setMatched(null);
    setActiveIntro(null);
    setChallengeQuery("");
    setMatchPhase("searching");
    setMatchHintIdx(0);
    hintTimer.current = setInterval(() => {
      setMatchHintIdx((i) => (i + 1) % 4);
    }, 700);
    const profile = {
      name: selfName.trim() || t("friends.matchYou"),
      level: selfLevel,
      cityId,
      utr: selfUtr,
    };
    searchTimer.current = setTimeout(() => {
      if (hintTimer.current) {
        clearInterval(hintTimer.current);
        hintTimer.current = null;
      }
      const buddy = pickBestMatch(profile, "singles", recentMatchIds.slice(0, 3), ladderPlayers, session.phone);
      if (!buddy) {
        setMatchPhase("empty");
        setMatched(null);
        return;
      }
      setMatched(buddy);
      setRecentMatchIds((prev) => [buddy.id, ...prev.filter((id) => id !== buddy.id)].slice(0, 6));
      setMatchPhase("found");
      void openIntroWithBuddy({ id: buddy.id, name: buddy.name }, "match", false);
    }, matchSearchMs());
  }

  function cancelMatchmaking() {
    clearSearchTimers();
    setMatchPhase("idle");
    setMatched(null);
  }

  function openSearchChallenge() {
    clearSearchTimers();
    setChallengeQuery("");
    setMatchPhase("searchChallenge");
  }

  const challengeResults = useMemo(() => {
    const q = challengeQuery.trim().toLowerCase();
    const self = (selfName.trim() || session.displayName || "").trim().toLowerCase();
    const pool = ladderPlayers.filter((p) => {
      if (!p?.name) return false;
      if (self && p.name.toLowerCase() === self) return false;
      if (session.phone && p.id === session.phone) return false;
      if (String(p.id || "").startsWith("self:")) return false;
      return true;
    });
    if (!q) return pool.slice(0, 8);
    return pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [challengeQuery, ladderPlayers, selfName, session.displayName, session.phone]);

  function updateSetLine(index: number, side: "a" | "b", value: string) {
    const cleaned = value.replace(/[^\d]/g, "").slice(0, 2);
    setSetLines((prev) => prev.map((row, i) => (i === index ? { ...row, [side]: cleaned } : row)));
  }

  async function onSaveScore() {
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
    setFormError("");
    setScoreNotice("");
    setHighlightNotice("");
    setScoreBusy(true);
    try {
      const res = await fetch("/tennis/api/friends/scores", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerA: aName,
          playerB: bName,
          sets,
          format,
          description: scoreDescDraft,
          hideFromPublic: scoreHideFromPublic === true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        score?: Parameters<typeof mapApiScore>[0];
        message?: string;
      };
      if (!res.ok) {
        setFormError(data.error || t("friends.scoreNeedNames"));
        return;
      }
      if (scoreHighlightFile && data.score?.id) {
        const form = new FormData();
        form.append("video", scoreHighlightFile);
        form.append("description", scoreDescDraft);
        await fetch(`/tennis/api/friends/scores/${encodeURIComponent(data.score.id)}/highlight`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
      }
      setScoreNotice(t("friends.scorePendingHint"));
      setPlayerA(selfName.trim() || aName);
      setPlayerB("");
      setSetLines([
        { a: "", b: "" },
        { a: "", b: "" },
        { a: "", b: "" },
      ]);
      setScoreDescDraft("");
      setScoreHideFromPublic(false);
      setScoreHighlightFile(null);
      if (scoreHighlightFileRef.current) scoreHighlightFileRef.current.value = "";
      setScoreFormOpen(false);
      await refreshScores();
      // Pending does NOT update ranking/UTR yet
    } catch {
      // Offline fallback: local pending only (not ranked)
      const row: SavedMatch = {
        id: `s-${Date.now()}`,
        savedAt: new Date().toISOString(),
        playerA: aName,
        playerB: bName,
        sets,
        winner,
        status: "pending",
        source: "local",
        description: scoreDescDraft,
        submitterHideFromPublic: scoreHideFromPublic === true,
        hideFromPublicFeed: scoreHideFromPublic === true,
      };
      const next = [row, ...history].slice(0, 40);
      setHistory(next);
      persistLocalScores(next);
      setMinePending((prev) => [row, ...prev]);
      setScoreNotice(t("friends.scorePendingHint"));
      setFormError(t("friends.scoreOfflinePending"));
      setScoreDescDraft("");
      setScoreHideFromPublic(false);
      setScoreHighlightFile(null);
      if (scoreHighlightFileRef.current) scoreHighlightFileRef.current.value = "";
      setScoreFormOpen(false);
    } finally {
      setScoreBusy(false);
    }
  }

  async function onScoreAction(id: string, action: "confirm" | "reject") {
    setScoreBusy(true);
    setFormError("");
    try {
      const hideFromPublic = action === "confirm" && confirmHideById[id] === true;
      const res = await fetch("/tennis/api/friends/scores/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(action === "confirm" ? { hideFromPublic } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error || t("friends.scoreNeedNames"));
        return;
      }
      setScoreNotice(
        action === "confirm" ? t("friends.scoreConfirmedHint") : t("friends.scoreRejectedHint"),
      );
      setConfirmHideById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      // Ladder + city「比赛结果」must refetch after confirm (UTR is computed on read).
      await Promise.all([
        refreshScores(),
        refreshLadder(),
        refreshDirectory(),
        refreshCityMatches(),
      ]);
    } catch {
      setFormError(t("friends.scoreNeedNames"));
    } finally {
      setScoreBusy(false);
    }
  }

  function isSelfLadderRow(row: LadderRow) {
    const selfId = String(session.phone || "").trim();
    const name = (selfName.trim() || String(session.displayName || "").trim()).toLowerCase();
    if (selfId && (row.id === selfId || String(row.id) === selfId)) return true;
    if (name && row.name.trim().toLowerCase() === name) return true;
    return false;
  }

  async function openLadderPlayerDetail(row: LadderRow) {
    setLadderDetail({
      id: row.id,
      name: row.name,
      rank: row.rank,
      rating: row.rating,
      played: Boolean(row.played),
    });
    setLadderDetailMatches([]);
    setLadderDetailHistoryHidden(false);
    setLadderDetailBusy(true);
    try {
      const q = new URLSearchParams({
        playerId: row.id,
        name: row.name,
        format,
      });
      const res = await fetch(`/tennis/api/friends/player-matches?${q}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          historyHidden?: boolean;
          matches?: {
            id: string;
            date: string;
            opponentName: string;
            result: "win" | "loss";
            sets: [number, number][];
            ratingDelta?: number;
            excluded?: boolean;
            softExcluded?: boolean;
            description?: string;
            highlightUrl?: string;
            highlightName?: string;
            comments?: MatchCommentPublic[];
            commentCount?: number;
          }[];
        };
        setLadderDetailHistoryHidden(data.historyHidden === true);
        setLadderDetailMatches(
          data.historyHidden === true
            ? []
            : Array.isArray(data.matches)
              ? data.matches.map((m) => ({
                  ...m,
                  description: String(m.description || ""),
                  highlightUrl: String(m.highlightUrl || ""),
                  highlightName: String(m.highlightName || ""),
                  comments: Array.isArray(m.comments) ? m.comments : [],
                  commentCount:
                    typeof m.commentCount === "number"
                      ? m.commentCount
                      : Array.isArray(m.comments)
                        ? m.comments.length
                        : 0,
                }))
              : [],
        );
      }
    } catch {
      setLadderDetailMatches([]);
      setLadderDetailHistoryHidden(false);
    } finally {
      setLadderDetailBusy(false);
    }
  }

  function challengeLadderRow(row: LadderRow) {
    if (isSelfLadderRow(row) || introBusy) return;
    setFriendsMainTab("match");
    setMatched({
      id: row.id,
      name: row.name,
      cityId: row.cityId || cityId,
      ntrp: Number(row.ntrp) || selfLevel,
      rating: row.rating,
      rank: row.rank,
      wins: row.wins,
      losses: row.losses,
      score: row.rating,
      utrDelta: Math.abs(row.rating - selfUtr),
      levelDelta: 0,
      sameCity: (row.cityId || cityId) === cityId,
      reasonKey: (row.cityId || cityId) === cityId ? "sameCityOk" : "nearbyOk",
      projected: row.projected,
    });
    void openIntroWithBuddy({ id: row.id, name: row.name }, "challenge", false);
  }

  const matchHints = [
    t("friends.matchHint1"),
    t("friends.matchHint2"),
    t("friends.matchHint3"),
    t("friends.matchHint4"),
  ];

  const matchedCityName = matched
    ? cityLabel(getCity(matched.cityId) || { id: matched.cityId, zh: matched.cityId, en: matched.cityId, countryCode: "", aliases: [] }, locale)
    : "";

  const matchmakingBlock = (
      <section className="space-y-3" data-matchmaking="true" aria-label={t("friends.matchTitle")}>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("friends.matchTitle")}</h2>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label
                htmlFor="match-self-level"
                className="text-[11px] font-medium text-muted-foreground"
              >
                {t("friends.matchSelfLevel")}
              </label>
              <RatingHelpTip
                kind="level"
                title={t("friends.levelHelpTitle")}
                body={t("friends.levelHelpBody")}
                ariaLabel={t("friends.levelHelpAria")}
              />
            </div>
            <select
              id="match-self-level"
              data-match-self-level="true"
              value={String(selfLevel)}
              onChange={(e) => onPickLevel(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={t("friends.matchSelfLevel")}
            >
              {LEVEL_OPTIONS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv.toFixed(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2" data-match-self-stats="true">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold text-foreground"
                data-match-self-name-display="true"
                title={t("friends.matchSelfNameReadonlyHint")}
              >
                {selfName.trim() || session.displayName || t("friends.matchYou")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("friends.matchSelfMeta", { city: cityName, level: selfLevel.toFixed(1), utr: selfUtr.toFixed(1) })}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("friends.utrLabel")}
                <RatingHelpTip
                  kind="utr"
                  title={t("friends.utrHelpTitle")}
                  body={t("friends.utrHelpBody")}
                  ariaLabel={t("friends.utrHelpAria")}
                />
              </span>
              <p className="text-lg font-bold tabular-nums text-primary" data-match-self-utr={selfUtr}>
                {selfUtr.toFixed(1)}
              </p>
            </div>
          </div>

          {matchPhase === "idle" || matchPhase === "empty" ? (
            <div className="space-y-2">
              {matchPhase === "empty" ? (
                <p className="text-xs text-muted-foreground" data-match-empty="true">
                  {t("friends.matchEmpty", { city: cityName })}
                </p>
              ) : null}
              <button
                type="button"
                data-match-start="true"
                onClick={startMatchmaking}
                className="relative h-12 w-full overflow-hidden rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm transition active:scale-[0.99]"
              >
                {t("friends.matchStart")}
              </button>
            </div>
          ) : null}

          {matchPhase === "searching" ? (
            <div className="space-y-3 py-2 text-center" data-match-searching="true">
              <div className="relative mx-auto flex size-16 items-center justify-center">
                <span className="absolute size-14 animate-ping rounded-full bg-primary/20" aria-hidden />
                <span className="relative size-10 rounded-full bg-primary/90 shadow-inner" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-foreground">{t("friends.matchSearching")}</p>
              <p className="text-xs text-muted-foreground" data-match-hint={matchHintIdx}>
                {matchHints[matchHintIdx]}
              </p>
              <button
                type="button"
                data-match-cancel="true"
                onClick={cancelMatchmaking}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground"
              >
                {t("friends.matchCancel")}
              </button>
            </div>
          ) : null}

          {matchPhase === "found" && matched ? (
            <div className="space-y-3" data-match-found="true" data-match-buddy={matched.id}>
              <p className="text-center text-sm font-semibold text-primary">{t("friends.matchFound")}</p>
              <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3">
                <Avatar className="size-12">
                  <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
                    {matched.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-base font-bold text-foreground" data-match-buddy-name="true">
                      {matched.name}
                    </p>
                    <p className="shrink-0 text-base font-bold tabular-nums text-foreground" data-match-buddy-utr={matched.rating}>
                      {matched.rating.toFixed(1)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground" data-match-buddy-meta="true">
                    {t("friends.matchBuddyMeta", {
                      city: matchedCityName,
                      level: matched.ntrp.toFixed(1),
                      rank: matched.rank,
                    })}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-primary" data-match-reason={matched.reasonKey}>
                    {t(`friends.matchReason.${matched.reasonKey}`, {
                      utrDelta: matched.utrDelta.toFixed(1),
                      city: matchedCityName,
                    })}
                  </p>
                </div>
              </div>

              <div
                className="space-y-2 rounded-lg border border-border bg-card px-3 py-3"
                data-match-intro="true"
                data-match-intro-id={activeIntro?.id || ""}
                data-match-success={
                  activeIntro?.status === "pending" || activeIntro?.matchSuccess ? "true" : undefined
                }
              >
                <p className="text-[11px] font-medium text-muted-foreground">{t("friends.matchIntroTitle")}</p>
                {activeIntro?.status === "awaiting_accept" ? (
                  <p className="text-sm leading-6 text-foreground" data-match-awaiting="true">
                    {t("friends.matchAwaitingAccept", { name: matched.name })}
                  </p>
                ) : (
                  <>
                    <p
                      className="text-sm font-semibold leading-6 text-primary"
                      data-match-success-title="true"
                    >
                      {t("friends.matchSuccessTitle")}
                    </p>
                    <p className="text-sm leading-6 text-foreground" data-match-success-body="true">
                      {t("friends.matchSuccessBody")}
                    </p>
                    <p className="text-sm leading-6 text-foreground" data-match-intro-body="true">
                      {activeIntro?.body || t("friends.matchIntroBody")}
                    </p>
                    <p className="text-[11px] text-muted-foreground" data-match-success-wechat="true">
                      {t("friends.matchSuccessWechatHint")}
                    </p>
                    {activeIntro?.opponentWechat ? (
                      <p
                        className="mt-1 text-[11px] text-muted-foreground"
                        data-match-opponent-wechat="true"
                        data-match-opponent-name={matched.name}
                      >
                        {t("friends.matchOpponentWechat", {
                          name: matched.name,
                          wechat: String(activeIntro.opponentWechat),
                        })}
                      </p>
                    ) : null}
                  </>
                )}
                {(activeIntro?.status === "pending" || activeIntro?.matchSuccess) &&
                !(
                  (activeIntro?.linkedScore && mapApiScore(activeIntro.linkedScore)) ||
                  findScoreForOpponent(matched.name, history)
                ) ? (
                  <button
                    type="button"
                    data-match-enter-score="true"
                    onClick={() => goEnterScoreFromMatch(matched.name)}
                    className="h-10 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                  >
                    {t("friends.matchEnterScore")}
                  </button>
                ) : null}
                {(activeIntro?.canCancel !== false) ? (
                  <button
                    type="button"
                    data-match-intro-cancel="true"
                    disabled={introBusy}
                    onClick={() => {
                      if (activeIntro?.id) void onIntroAction(activeIntro.id, "cancel");
                      else {
                        setActiveIntro(null);
                        setMatched(null);
                        setMatchPhase("postCancel");
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                  >
                    {t("friends.matchIntroCancel")}
                  </button>
                ) : null}
              </div>
              {/* 录入对阵 / 去录入比分：仅对方应战后显示（上方 data-match-enter-score） */}
            </div>
          ) : null}

          {matchPhase === "postCancel" ? (
            <div className="space-y-3" data-match-post-cancel="true">
              <p className="text-xs leading-5 text-muted-foreground">{t("friends.matchIntroCancelled")}</p>
              <button
                type="button"
                data-match-rematch="true"
                onClick={startMatchmaking}
                className="h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground"
              >
                {t("friends.matchRematch")}
              </button>
              <button
                type="button"
                data-match-search-challenge="true"
                onClick={openSearchChallenge}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
              >
                {t("friends.matchSearchChallenge")}
              </button>
            </div>
          ) : null}

          {matchPhase === "searchChallenge" ? (
            <div className="space-y-3" data-match-search-challenge-panel="true">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">{t("friends.matchSearchChallenge")}</span>
                <input
                  data-match-search-input="true"
                  value={challengeQuery}
                  onChange={(e) => setChallengeQuery(e.target.value)}
                  placeholder={t("friends.matchSearchPh")}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              {challengeResults.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-match-search-empty="true">
                  {t("friends.matchSearchEmpty")}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  {challengeResults.map((row, index) => (
                    <div
                      key={row.id}
                      data-match-search-row={row.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                        index === challengeResults.length - 1 ? "" : "border-b border-border"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {(getCity(row.cityId) ? cityLabel(getCity(row.cityId) as City, locale) : row.cityId)} · {Number(row.ntrp).toFixed(1)}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-match-challenge={row.id}
                        disabled={introBusy}
                        onClick={() => {
                          setMatched({
                            id: row.id,
                            name: row.name,
                            cityId: row.cityId,
                            ntrp: row.ntrp,
                            rating: utrSeedFromSelfLevel(row.ntrp),
                            rank: 0,
                            wins: 0,
                            losses: 0,
                            score: 0,
                            utrDelta: 0,
                            levelDelta: 0,
                            sameCity: row.cityId === cityId,
                            reasonKey: row.cityId === cityId ? "sameCityOk" : "nearbyOk",
                            projected: true,
                          });
                          void openIntroWithBuddy({ id: row.id, name: row.name }, "challenge", false);
                        }}
                        className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      >
                        {t("friends.matchChallenge")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                data-match-rematch="true"
                onClick={startMatchmaking}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
              >
                {t("friends.matchRematch")}
              </button>
            </div>
          ) : null}
        </div>
      </section>
      );

  return (
    <div
      className={pageClass}
      data-page="friends"
      data-friends-city={cityId}
      data-friends-matchmaking="true"
      data-friends-city-dual-tabs="true"
      data-yueqiu-tabs="my-and-ladder"
      data-friends-main-tab={friendsMainTab}
    >
      <div>
        <h1 className="text-base font-bold text-foreground">{t("friends.title")}</h1>
        {!cityReady ? (
          <p className="mt-1 text-xs text-muted-foreground" data-city-detecting="true">
            {t("friends.cityDetecting")}
          </p>
        ) : null}
      </div>

      <section className="space-y-2" data-city-scope="true" data-city-before-match="true" data-city-before-tabs="true">
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
      </section>

      <div
        className="flex gap-2"
        data-friends-main-tabs="true"
        role="tablist"
        aria-label={t("friends.mainTabsAria")}
      >
        {(
          [
            { id: "match" as const, label: t("friends.tabMatch") },
            { id: "ladder" as const, label: t("friends.tabLadder") },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={friendsMainTab === item.id}
            data-friends-main-tab-btn={item.id}
            data-friends-main-tab-selected={friendsMainTab === item.id ? "true" : undefined}
            onClick={() => setFriendsMainTab(item.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold",
              friendsMainTab === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {friendsMainTab === "match" ? (
      <div className="space-y-6" data-friends-main-panel="match" data-friends-match-panel="true" data-match-panel-order="matchmaking-records-invites-sent">
      {matchmakingBlock}
      <section
        className="space-y-4"
        data-match-records="true"
        data-match-records-inline-scores="true"
        data-score-mine-pending={minePending.length}
        aria-label={t("friends.matchSuccessListTitle")}
      >
        <div className="space-y-2" data-match-success-list="true" data-match-success-db-fidelity="true">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("friends.matchSuccessListTitle")}</h2>
          </div>
          {successRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-match-success-empty="true">
              {t("friends.matchSuccessListEmpty")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {successRecords.map((row, index) => {
                const opponent =
                  row.opponentName ||
                  (row.iAmFrom === false ? row.fromName : row.toName) ||
                  row.toName ||
                  row.fromName;
                const linkedFromIntro = row.linkedScore
                  ? mapApiScore(row.linkedScore)
                  : undefined;
                const fromHistoryById = linkedFromIntro
                  ? history.find((s) => s.id === linkedFromIntro.id)
                  : undefined;
                const linkedScore =
                  fromHistoryById || linkedFromIntro || findScoreForOpponent(opponent, history);
                const hasScore = Boolean(linkedScore);
                const acceptRaw = row.acceptedAt || row.updatedAt || row.createdAt || "";
                const scoreWhenRaw = linkedScore?.savedAt || acceptRaw;
                const whenLabel = scoreWhenRaw
                  ? new Date(scoreWhenRaw).toLocaleString(locale === "zh" ? "zh-CN" : "en", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                const winnerName = linkedScore
                  ? linkedScore.winner === "A"
                    ? linkedScore.playerA
                    : linkedScore.playerB
                  : "";
                const status = linkedScore?.status || "confirmed";
                const statusLabel =
                  status === "pending"
                    ? t("friends.scoreStatusPending")
                    : status === "rejected"
                      ? t("friends.scoreStatusRejected")
                      : t("friends.scoreStatusConfirmed");
                return (
                  <div
                    key={row.id}
                    data-match-success-row={row.id}
                    data-match-success-opponent={opponent}
                    data-match-success-scored={hasScore ? "true" : "false"}
                    className={`space-y-2 px-4 py-3 ${
                      index === successRecords.length - 1 ? "" : "border-b border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold text-foreground"
                          data-match-success-opponent-name={opponent}
                        >
                          {t("friends.matchSuccessRecord", { name: opponent })}
                        </p>
                        {row.opponentWechat ? (
                          <p
                            className="mt-0.5 text-[11px] text-muted-foreground"
                            data-match-success-opponent-wechat={row.id}
                          >
                            {t("friends.matchOpponentWechat", {
                              name: opponent,
                              wechat: String(row.opponentWechat),
                            })}
                          </p>
                        ) : null}
                        {hasScore && linkedScore ? (
                          <>
                            <p
                              className="mt-0.5 text-xs text-muted-foreground"
                              data-match-success-score={row.id}
                            >
                              {formatSets(linkedScore.sets)}
                            </p>
                            <p
                              className="mt-0.5 text-[11px] text-muted-foreground"
                              data-match-success-winner={row.id}
                            >
                              {t("friends.winnerLine", { name: winnerName })}
                              {status === "pending" ? ` · ${statusLabel}` : ""}
                            </p>
                            {whenLabel ? (
                              <p
                                className="mt-0.5 text-[11px] text-muted-foreground"
                                data-match-success-time={row.id}
                              >
                                {whenLabel}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="mt-0.5 text-[11px] text-primary">
                              {t("friends.matchSuccessRecordMeta")}
                            </p>
                            {whenLabel ? (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{whenLabel}</p>
                            ) : null}
                          </>
                        )}
                      </div>
                      {!hasScore ? (
                        <button
                          type="button"
                          data-match-success-enter-score={row.id}
                          onClick={() => goEnterScoreFromMatch(opponent)}
                          className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                        >
                          {t("friends.matchEnterScore")}
                        </button>
                      ) : null}
                    </div>

                    {hasScore && linkedScore ? (
                      <div
                        className="space-y-2 border-t border-border/60 pt-2"
                        data-match-highlight-block={linkedScore.id}
                      >
                        {linkedScore.description ? (
                          <p
                            className="text-xs leading-5 text-foreground"
                            data-match-highlight-desc={linkedScore.id}
                          >
                            {linkedScore.description}
                          </p>
                        ) : null}
                        {linkedScore.highlightUrl ? (
                          <div data-match-highlight-media={linkedScore.id}>
                            <MatchMedia
                              url={linkedScore.highlightUrl}
                              name={linkedScore.highlightName}
                            />
                          </div>
                        ) : null}
                        {status === "pending" &&
                        (linkedScore.description || linkedScore.highlightUrl) ? (
                          <p
                            className="text-[11px] text-muted-foreground"
                            data-match-highlight-pending-note={linkedScore.id}
                          >
                            {t("friends.highlightPendingNote")}
                          </p>
                        ) : null}

                        {status === "confirmed" || !linkedScore.status ? (
                          <div className="space-y-2" data-match-comments={linkedScore.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setCommentsOpen((prev) => ({
                                  ...prev,
                                  [linkedScore.id]: !prev[linkedScore.id],
                                }))
                              }
                              className="text-[11px] font-medium text-muted-foreground"
                              data-match-comments-toggle={linkedScore.id}
                            >
                              {t("friends.commentsTitle", {
                                count: String(
                                  linkedScore.commentCount || linkedScore.comments?.length || 0,
                                ),
                              })}
                            </button>
                            {commentsOpen[linkedScore.id] ? (
                              <div
                                className="space-y-2"
                                data-match-comments-panel={linkedScore.id}
                              >
                                {(linkedScore.comments || []).length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {t("friends.commentsEmpty")}
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {(linkedScore.comments || []).map((c) => (
                                      <li
                                        key={c.id}
                                        className="rounded-md bg-muted/30 px-2 py-1.5"
                                        data-match-comment={c.id}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-[11px] font-semibold text-foreground">
                                            {c.authorName}
                                          </p>
                                          {normName(c.authorName) ===
                                          normName(selfName || session.displayName || "") ? (
                                            <button
                                              type="button"
                                              disabled={commentBusyId === linkedScore.id}
                                              onClick={() =>
                                                void removeComment(linkedScore.id, c.id)
                                              }
                                              className="text-[10px] text-muted-foreground"
                                              data-match-comment-delete={c.id}
                                            >
                                              {t("friends.commentDelete")}
                                            </button>
                                          ) : null}
                                        </div>
                                        <p className="mt-0.5 text-xs leading-5 text-foreground">
                                          {c.body}
                                        </p>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={commentDrafts[linkedScore.id] || ""}
                                    onChange={(e) =>
                                      setCommentDrafts((prev) => ({
                                        ...prev,
                                        [linkedScore.id]: e.target.value,
                                      }))
                                    }
                                    maxLength={1000}
                                    placeholder={t("friends.commentPlaceholder")}
                                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                                    data-match-comment-input={linkedScore.id}
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      commentBusyId === linkedScore.id ||
                                      !String(commentDrafts[linkedScore.id] || "").trim()
                                    }
                                    onClick={() => void submitComment(linkedScore.id)}
                                    className="h-8 shrink-0 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                                    data-match-comment-submit={linkedScore.id}
                                  >
                                    {t("friends.commentSubmit")}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {highlightNotice ? (
          <p className="text-[11px] text-muted-foreground" data-match-highlight-notice="true">
            {highlightNotice}
          </p>
        ) : null}

        {minePending.length > 0 ? (
          <div className="space-y-2" data-score-mine-pending-list="true">
            <h3 className="text-sm font-semibold text-foreground">{t("friends.scorePendingHint")}</h3>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {minePending.map((row, index) => {
                const winnerName = row.winner === "A" ? row.playerA : row.playerB;
                return (
                  <div
                    key={row.id}
                    data-score-mine-pending-row={row.id}
                    className={cn(
                      "space-y-2 px-4 py-3",
                      index === minePending.length - 1 ? "" : "border-b border-border",
                    )}
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.playerA} vs {row.playerB}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatSets(row.sets)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("friends.winnerLine", { name: winnerName })} · {t("friends.scoreStatusPending")}
                    </p>
                    <p
                      className="text-[11px] text-muted-foreground"
                      data-score-mine-pending-privacy={row.id}
                    >
                      {row.submitterHideFromPublic
                        ? t("friends.scorePrivacyPendingHide")
                        : t("friends.scorePrivacyPendingShow")}
                    </p>
                    {row.description || row.highlightUrl ? (
                      <div className="space-y-2" data-score-mine-pending-highlight={row.id}>
                        {row.description ? (
                          <p className="text-xs leading-5 text-foreground">{row.description}</p>
                        ) : null}
                        {row.highlightUrl ? (
                          <MatchMedia url={row.highlightUrl} name={row.highlightName} />
                        ) : null}
                        <p className="text-[11px] text-muted-foreground">
                          {t("friends.highlightPendingNote")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {pendingForMe.length > 0 ? (
          <div className="space-y-2" data-score-pending-inbox="true">
            <h3 className="text-sm font-semibold text-foreground">{t("friends.scorePendingInbox")}</h3>
            <div className="overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5">
              {pendingForMe.map((row, index) => {
                const winnerName = row.winner === "A" ? row.playerA : row.playerB;
                const confirmHide = confirmHideById[row.id] === true;
                return (
                  <div
                    key={row.id}
                    data-score-pending-row={row.id}
                    className={cn(
                      "space-y-2 px-4 py-3",
                      index === pendingForMe.length - 1 ? "" : "border-b border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.playerA} vs {row.playerB}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatSets(row.sets)}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("friends.winnerLine", { name: winnerName })} · {t("friends.scoreStatusPending")}
                        </p>
                      </div>
                    </div>
                    {row.description || row.highlightUrl ? (
                      <div className="space-y-2" data-score-pending-highlight={row.id}>
                        {row.description ? (
                          <p className="text-xs leading-5 text-foreground">{row.description}</p>
                        ) : null}
                        {row.highlightUrl ? (
                          <MatchMedia url={row.highlightUrl} name={row.highlightName} />
                        ) : null}
                      </div>
                    ) : null}
                    <ScorePrivacyToggle
                      valueHide={confirmHide}
                      onChange={(hide) =>
                        setConfirmHideById((prev) => ({ ...prev, [row.id]: hide }))
                      }
                      label={t("friends.scorePrivacyConfirmLabel")}
                      hint={
                        row.submitterHideFromPublic
                          ? t("friends.scorePrivacySubmitterHid")
                          : t("friends.scorePrivacyHint")
                      }
                      testId={`confirm-${row.id}`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-score-reject={row.id}
                        disabled={scoreBusy}
                        onClick={() => void onScoreAction(row.id, "reject")}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted-foreground"
                      >
                        {t("friends.scoreReject")}
                      </button>
                      <button
                        type="button"
                        data-score-confirm-btn={row.id}
                        disabled={scoreBusy}
                        onClick={() => void onScoreAction(row.id, "confirm")}
                        className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      >
                        {t("friends.scoreConfirm")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {scoreFormOpen ? (
          <section
            id="score-entry"
            className="space-y-3 scroll-mt-20"
            data-score-entry="true"
            data-score-confirm="true"
            data-score-form-open="true"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t("friends.scoreTitle")}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("friends.scoreLeadConfirm")}</p>
              </div>
              <button
                type="button"
                data-score-form-toggle="true"
                data-score-form-open="true"
                onClick={() => setScoreFormOpen(false)}
                className="shrink-0 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                {t("friends.scoreFormHide")}
              </button>
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
              <ScorePrivacyToggle
                valueHide={scoreHideFromPublic}
                onChange={setScoreHideFromPublic}
                label={t("friends.scorePrivacyLabel")}
                hint={t("friends.scorePrivacyHint")}
                testId="entry"
              />
              <div className="space-y-2" data-score-highlight-fields="true">
                <textarea
                  value={scoreDescDraft}
                  onChange={(e) => setScoreDescDraft(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={t("friends.highlightDescPlaceholder")}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                  data-score-highlight-desc="true"
                />
                <p className="text-[11px] text-muted-foreground" data-score-highlight-hint="true">
                  {t("friends.highlightWithScoreHint")}
                </p>
                <input
                  ref={scoreHighlightFileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  onChange={(e) => setScoreHighlightFile(e.target.files?.[0] || null)}
                  className="sr-only"
                  data-score-highlight-file="true"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  data-score-highlight-pick="true"
                  onClick={() => scoreHighlightFileRef.current?.click()}
                  className="flex h-14 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold tracking-wide text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                >
                  {t("friends.highlightFileLabel")}
                </button>
                {scoreHighlightFile ? (
                  <p className="truncate text-center text-xs font-medium text-foreground" data-score-highlight-chosen="true">
                    {scoreHighlightFile.name}
                  </p>
                ) : null}
              </div>
              {formError ? (
                <p className="text-xs text-destructive" data-score-error="true">
                  {formError}
                </p>
              ) : null}
              {scoreNotice ? (
                <p className="text-xs text-primary" data-score-notice="true">
                  {scoreNotice}
                </p>
              ) : null}
              <button
                type="button"
                data-score-save="true"
                disabled={scoreBusy}
                onClick={() => void onSaveScore()}
                className="h-9 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {t("friends.saveScore")}
              </button>
            </div>
          </section>
        ) : null}
      </section>

      {introInbox.some(isOpenInvite) ? (
        <section className="space-y-2" data-match-intro-inbox="true">
          <h2 className="text-sm font-semibold text-foreground">{t("friends.matchIntroInbox")}</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {introInbox.filter(isOpenInvite).map((row, index, list) => (
              <div
                key={row.id}
                data-match-intro-inbox-row={row.id}
                className={`space-y-2 px-4 py-3 ${index === list.length - 1 ? "" : "border-b border-border"}`}
              >
                <p className="text-sm font-medium text-foreground">
                  {row.fromName} → {row.toName}
                </p>
                <p className="text-xs text-muted-foreground" data-match-intro-incoming="true">
                  {t("friends.matchInviteIncoming", { name: row.fromName })}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-match-intro-decline={row.id}
                    disabled={introBusy}
                    onClick={() => void onIntroAction(row.id, "cancel")}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted-foreground"
                  >
                    {t("friends.matchChallengeDecline")}
                  </button>
                  <button
                    type="button"
                    data-match-intro-accept={row.id}
                    disabled={introBusy}
                    onClick={() => void onIntroAction(row.id, "accept")}
                    className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                  >
                    {t("friends.matchChallengeAccept")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2" data-match-sent-pending="true" aria-label={t("friends.matchSentPendingTitle")}>
        <h2 className="text-sm font-semibold text-foreground">{t("friends.matchSentPendingTitle")}</h2>
        {sentPending.filter(isSentPendingInvite).length === 0 ? (
          <p className="text-xs text-muted-foreground" data-match-sent-pending-empty="true">
            {t("friends.matchSentPendingEmpty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {sentPending.filter(isSentPendingInvite).map((row, index, list) => {
              const opponent =
                row.opponentName ||
                row.toName ||
                row.fromName ||
                "";
              return (
                <div
                  key={row.id}
                  data-match-sent-pending-row={row.id}
                  data-match-sent-pending-opponent={opponent}
                  className={`space-y-2 px-4 py-3 ${index === list.length - 1 ? "" : "border-b border-border"}`}
                >
                  <p className="text-sm font-medium text-foreground">{opponent}</p>
                  <p className="text-xs text-muted-foreground" data-match-sent-pending-waiting="true">
                    {t("friends.matchSentPendingWaiting", { name: opponent })}
                  </p>
                  {row.canCancel !== false ? (
                    <button
                      type="button"
                      data-match-sent-pending-cancel={row.id}
                      disabled={introBusy}
                      onClick={() => void onIntroAction(row.id, "cancel")}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted-foreground disabled:opacity-60"
                    >
                      {t("friends.matchIntroCancel")}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>
      ) : (
      <div className="space-y-6" data-friends-main-panel="ladder" data-friends-ladder-panel="true" data-ladder-panel-order="ladder-results-matchmaking">
      <section className="space-y-3" data-ladder={format} data-ladder-city={cityId}>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">{t("friends.rankTitle")}</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("friends.utrLabel")}
              <RatingHelpTip
                kind="utr"
                title={t("friends.utrHelpTitle")}
                body={t("friends.utrHelpBody")}
                ariaLabel={t("friends.utrHelpAria")}
              />
            </span>
          </div>
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
              <LadderRowView
                key={row.id}
                row={row}
                last={index === ladder.length - 1}
                selfRow={isSelfLadderRow(row)}
                busy={introBusy}
                onOpen={() => void openLadderPlayerDetail(row)}
                onChallenge={() => challengeLadderRow(row)}
              />
            ))}
          </div>
        )}

        <Dialog
          open={Boolean(ladderDetail)}
          onOpenChange={(open) => {
            if (!open) setLadderDetail(null);
          }}
        >
          <DialogContent
            className="max-h-[min(80vh,36rem)] overflow-y-auto sm:max-w-md"
            data-ladder-player-modal={ladderDetail?.id || ""}
            data-ladder-player-detail={ladderDetail?.id || ""}
            showCloseButton
          >
            {ladderDetail ? (
              <>
                <DialogHeader>
                  <DialogTitle className="truncate pr-8">
                    {t("friends.playerDetailTitle", { name: ladderDetail.name })}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground">
                    <span
                      data-ladder-detail-rating={ladderDetail.rating}
                      data-ladder-detail-untested={!ladderDetail.played ? "true" : "false"}
                    >
                      #{ladderDetail.rank} · {ladderDetail.rating.toFixed(1)}
                    </span>
                    {!ladderDetail.played ? (
                      <span
                        className="mt-1 block text-[10px] font-normal leading-snug text-muted-foreground"
                        data-ladder-detail-untested-hint="true"
                      >
                        {t("friends.seedOnly")}
                      </span>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>
                {!ladderDetailHistoryHidden ? (
                <div className="space-y-3" data-ladder-player-recent="true">
                  <h4 className="text-xs font-semibold text-foreground">{t("friends.playerRecentTitle")}</h4>
                  {ladderDetailBusy ? (
                    <p className="text-xs text-muted-foreground">…</p>
                  ) : ladderDetailMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-ladder-player-recent-empty="true">
                      {t("friends.playerRecentEmpty")}
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      {ladderDetailMatches.map((m, index) => (
                        <div
                          key={m.id}
                          data-ladder-player-recent-row={m.id}
                          className={cn(
                            "space-y-2 px-3 py-2.5",
                            index === ladderDetailMatches.length - 1 ? "" : "border-b border-border",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {t(
                                  m.result === "win"
                                    ? "friends.playerRecentWin"
                                    : "friends.playerRecentLoss",
                                  { name: m.opponentName || "—" },
                                )}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {m.sets?.length ? formatSets(m.sets) : ""}
                                {m.sets?.length ? " · " : ""}
                                {m.date}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              {typeof m.ratingDelta === "number" && m.ratingDelta !== 0 ? (
                                <p
                                  className={cn(
                                    "text-xs font-semibold tabular-nums",
                                    m.ratingDelta > 0 ? "text-emerald-600" : "text-rose-600",
                                  )}
                                  data-ladder-player-recent-delta={m.ratingDelta}
                                >
                                  {m.ratingDelta > 0
                                    ? t("friends.deltaRatingUp", { n: m.ratingDelta.toFixed(1) })
                                    : t("friends.deltaRatingDown", { n: m.ratingDelta.toFixed(1) })}
                                </p>
                              ) : typeof m.ratingDelta === "number" ? (
                                <p
                                  className="text-xs font-semibold tabular-nums text-muted-foreground"
                                  data-ladder-player-recent-delta={m.ratingDelta}
                                >
                                  0.0
                                </p>
                              ) : null}
                              {m.softExcluded ? (
                                <p
                                  className="mt-0.5 max-w-[9.5rem] text-[10px] leading-4 text-muted-foreground"
                                  data-ladder-player-soft-exclude="true"
                                >
                                  {t("journey.softExcludeHint")}
                                </p>
                              ) : null}
                              {!m.softExcluded && m.excluded ? (
                                <p
                                  className="mt-0.5 max-w-[9.5rem] text-[10px] leading-4 text-muted-foreground"
                                  data-ladder-player-excluded="true"
                                >
                                  {t("journey.excludedHint")}
                                </p>
                              ) : null}
                              {!m.softExcluded &&
                              !m.excluded &&
                              m.result === "win" &&
                              typeof m.ratingDelta === "number" &&
                              m.ratingDelta === 0 ? (
                                <p
                                  className="mt-0.5 max-w-[9.5rem] text-[10px] leading-4 text-muted-foreground"
                                  data-ladder-player-barely="true"
                                >
                                  {t("journey.barelyCountHint")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {m.description || m.highlightUrl ? (
                            <div className="space-y-1.5" data-ladder-player-highlight={m.id}>
                              {m.description ? (
                                <p className="text-xs leading-5 text-foreground">{m.description}</p>
                              ) : null}
                              {m.highlightUrl ? (
                                <MatchMedia url={m.highlightUrl} name={m.highlightName} />
                              ) : null}
                            </div>
                          ) : null}
                          <div className="space-y-2" data-ladder-player-comments={m.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setCommentsOpen((prev) => ({
                                  ...prev,
                                  [m.id]: !prev[m.id],
                                }))
                              }
                              className="text-[11px] font-medium text-muted-foreground"
                              data-ladder-player-comments-toggle={m.id}
                            >
                              {t("friends.commentsTitle", {
                                count: String(m.commentCount || m.comments?.length || 0),
                              })}
                            </button>
                            {commentsOpen[m.id] ? (
                              <div className="space-y-2" data-ladder-player-comments-panel={m.id}>
                                {(m.comments || []).length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {t("friends.commentsEmpty")}
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {(m.comments || []).map((c) => (
                                      <li
                                        key={c.id}
                                        className="rounded-md bg-muted/30 px-2 py-1.5"
                                        data-ladder-player-comment={c.id}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-[11px] font-semibold text-foreground">
                                            {c.authorName}
                                          </p>
                                          {normName(c.authorName) ===
                                          normName(selfName || session.displayName || "") ? (
                                            <button
                                              type="button"
                                              disabled={commentBusyId === m.id}
                                              onClick={() => void removeComment(m.id, c.id)}
                                              className="text-[10px] text-muted-foreground"
                                              data-ladder-player-comment-delete={c.id}
                                            >
                                              {t("friends.commentDelete")}
                                            </button>
                                          ) : null}
                                        </div>
                                        <p className="mt-0.5 text-xs leading-5 text-foreground">
                                          {c.body}
                                        </p>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={commentDrafts[m.id] || ""}
                                    onChange={(e) =>
                                      setCommentDrafts((prev) => ({
                                        ...prev,
                                        [m.id]: e.target.value,
                                      }))
                                    }
                                    maxLength={1000}
                                    placeholder={t("friends.commentPlaceholder")}
                                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                                    data-ladder-player-comment-input={m.id}
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      commentBusyId === m.id ||
                                      !String(commentDrafts[m.id] || "").trim()
                                    }
                                    onClick={() => void submitComment(m.id)}
                                    className="h-8 shrink-0 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                                    data-ladder-player-comment-submit={m.id}
                                  >
                                    {t("friends.commentSubmit")}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                ) : null}
                <button
                  type="button"
                  data-ladder-player-detail-close="true"
                  onClick={() => setLadderDetail(null)}
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground"
                >
                  {t("friends.playerDetailClose")}
                </button>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </section>

      <section className="space-y-3" data-ladder-city-results="true" data-ladder-city-results-city={cityId}>
        <h2 className="text-sm font-semibold text-foreground">{t("friends.cityResultsTitle")}</h2>
        {cityMatches.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-ladder-city-results-empty="true">
            {t("friends.cityResultsEmpty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card" data-ladder-city-results-list="true">
            {cityMatches.map((m, index) => {
              const when = formatMatchTime(m.savedAt);
              const scoreLine = m.sets?.length ? formatSets(m.sets) : "";
              const winnerName = m.winner === "A" ? m.playerA : m.playerB;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-ladder-city-result-row={m.id}
                  onClick={() => {
                    setCityMatchDetail(m);
                    setCommentsOpen((prev) => ({ ...prev, [m.id]: true }));
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-muted/40",
                    index === cityMatches.length - 1 ? "" : "border-b border-border",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t("friends.cityResultsVs", { a: m.playerA, b: m.playerB })}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {scoreLine}
                      {scoreLine && when ? " · " : ""}
                      {when}
                      {winnerName ? ` · ${t("friends.cityResultsWinner", { name: winnerName })}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-primary">
                    {t("friends.cityResultsOpen")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <Dialog
          open={Boolean(cityMatchDetail)}
          onOpenChange={(open) => {
            if (!open) setCityMatchDetail(null);
          }}
        >
          <DialogContent
            className="max-h-[min(80vh,36rem)] overflow-y-auto sm:max-w-md"
            data-ladder-city-result-modal={cityMatchDetail?.id || ""}
            showCloseButton
          >
            {cityMatchDetail ? (
              <>
                <DialogHeader>
                  <DialogTitle className="truncate pr-8">
                    {t("friends.cityResultsDetailTitle")}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground">
                    {t("friends.cityResultsVs", {
                      a: cityMatchDetail.playerA,
                      b: cityMatchDetail.playerB,
                    })}
                    {cityMatchDetail.sets?.length ? ` · ${formatSets(cityMatchDetail.sets)}` : ""}
                    {cityMatchDetail.savedAt
                      ? ` · ${formatMatchTime(cityMatchDetail.savedAt)}`
                      : ""}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3" data-ladder-city-result-detail={cityMatchDetail.id}>
                  {cityMatchDetail.description || cityMatchDetail.highlightUrl ? (
                    <div className="space-y-1.5" data-ladder-city-result-highlight={cityMatchDetail.id}>
                      {cityMatchDetail.description ? (
                        <p className="text-xs leading-5 text-foreground">{cityMatchDetail.description}</p>
                      ) : null}
                      {cityMatchDetail.highlightUrl ? (
                        <MatchMedia
                          url={cityMatchDetail.highlightUrl}
                          name={cityMatchDetail.highlightName}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-2" data-ladder-city-result-comments={cityMatchDetail.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setCommentsOpen((prev) => ({
                          ...prev,
                          [cityMatchDetail.id]: !prev[cityMatchDetail.id],
                        }))
                      }
                      className="text-[11px] font-medium text-muted-foreground"
                      data-ladder-city-result-comments-toggle={cityMatchDetail.id}
                    >
                      {t("friends.commentsTitle", {
                        count: String(
                          cityMatchDetail.commentCount || cityMatchDetail.comments?.length || 0,
                        ),
                      })}
                    </button>
                    {commentsOpen[cityMatchDetail.id] ? (
                      <div
                        className="space-y-2"
                        data-ladder-city-result-comments-panel={cityMatchDetail.id}
                      >
                        {(cityMatchDetail.comments || []).length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            {t("friends.commentsEmpty")}
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {(cityMatchDetail.comments || []).map((c) => (
                              <li
                                key={c.id}
                                className="rounded-md bg-muted/30 px-2 py-1.5"
                                data-ladder-city-result-comment={c.id}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[11px] font-semibold text-foreground">
                                    {c.authorName}
                                  </p>
                                  {normName(c.authorName) ===
                                  normName(selfName || session.displayName || "") ? (
                                    <button
                                      type="button"
                                      disabled={commentBusyId === cityMatchDetail.id}
                                      onClick={() => void removeComment(cityMatchDetail.id, c.id)}
                                      className="text-[10px] text-muted-foreground"
                                      data-ladder-city-result-comment-delete={c.id}
                                    >
                                      {t("friends.commentDelete")}
                                    </button>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-xs leading-5 text-foreground">{c.body}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentDrafts[cityMatchDetail.id] || ""}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [cityMatchDetail.id]: e.target.value,
                              }))
                            }
                            maxLength={1000}
                            placeholder={t("friends.commentPlaceholder")}
                            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                            data-ladder-city-result-comment-input={cityMatchDetail.id}
                          />
                          <button
                            type="button"
                            disabled={
                              commentBusyId === cityMatchDetail.id ||
                              !String(commentDrafts[cityMatchDetail.id] || "").trim()
                            }
                            onClick={() => void submitComment(cityMatchDetail.id)}
                            className="h-8 shrink-0 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                            data-ladder-city-result-comment-submit={cityMatchDetail.id}
                          >
                            {t("friends.commentSubmit")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    data-ladder-city-result-close="true"
                    onClick={() => setCityMatchDetail(null)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground"
                  >
                    {t("friends.cityResultsClose")}
                  </button>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </section>

      {matchmakingBlock}
      </div>
      )}
    </div>
  );
}

function formatMatchTime(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatLadderDelta(
  t: (key: string, params?: Record<string, string | number>) => string,
  rankDelta: number | null | undefined,
  ratingDelta: number | null | undefined,
) {
  if (rankDelta == null && ratingDelta == null) return "";
  const rank =
    !rankDelta || rankDelta === 0
      ? ""
      : rankDelta > 0
        ? t("friends.deltaRankUp", { n: rankDelta })
        : t("friends.deltaRankDown", { n: Math.abs(rankDelta) });
  const rating =
    ratingDelta == null || ratingDelta === 0
      ? ""
      : ratingDelta > 0
        ? t("friends.deltaRatingUp", { n: ratingDelta.toFixed(1) })
        : t("friends.deltaRatingDown", { n: ratingDelta.toFixed(1) });
  if (!rank && !rating) return t("friends.deltaFlat");
  return [rank, rating].filter(Boolean).join(" ");
}

function LadderRowView({
  row,
  last,
  selfRow,
  busy,
  onOpen,
  onChallenge,
}: {
  row: LadderRow & { rankDelta?: number | null; ratingDelta?: number | null };
  last: boolean;
  selfRow: boolean;
  busy: boolean;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  const { t } = useI18n();
  const unplayed = !row.played;
  const form = t("friends.form", { w: row.wins, l: row.losses });
  const unprovenNote = t("friends.seedOnly");
  // Plain numeric rating (no trailing ?); unplayed → small caption under score.
  const ratingLabel = row.rating.toFixed(1);
  const lastLine =
    !unplayed && row.lastResult && row.lastOpponentName
      ? t(row.lastResult === "win" ? "friends.beat" : "friends.lost", { name: row.lastOpponentName })
      : "";
  const deltaLabel = unplayed ? "" : formatLadderDelta(t, row.rankDelta, row.ratingDelta);
  const deltaUp = (row.rankDelta || 0) > 0 || (row.ratingDelta || 0) > 0;
  const deltaDown = (row.rankDelta || 0) < 0 || (row.ratingDelta || 0) < 0;
  return (
    <div
      data-ladder-row={row.id}
      data-ladder-rank={row.rank}
      data-ladder-city={row.cityId}
      data-ladder-self={selfRow ? "true" : undefined}
      data-ladder-unplayed={unplayed ? "true" : "false"}
      data-ladder-rank-delta={unplayed ? "" : row.rankDelta ?? ""}
      data-ladder-rating-delta={unplayed ? "" : row.ratingDelta ?? ""}
      className={cn("flex items-start gap-3 px-4 py-3", last ? "" : "border-b border-border")}
    >
      <p className="w-6 shrink-0 text-sm font-bold text-primary">{row.rank}</p>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary-subtle text-sm font-semibold text-primary">
            {row.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              data-ladder-player-open={row.id}
              data-ladder-player-name={row.id}
              onClick={onOpen}
              className="truncate text-left text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              {row.name}
            </button>
            <div
              className="flex shrink-0 flex-col items-end gap-0.5"
              data-ladder-rating-block={unplayed ? "unproven" : "tested"}
            >
              <p
                className="text-sm font-bold tabular-nums text-foreground"
                data-ladder-rating={row.rating}
                data-ladder-rating-display={ratingLabel}
                data-ladder-untested={unplayed ? "true" : "false"}
                data-ladder-projected={!unplayed && row.projected ? "true" : "false"}
                aria-label={unplayed ? `${ratingLabel} · ${unprovenNote}` : ratingLabel}
              >
                {ratingLabel}
              </p>
              {unplayed ? (
                <p
                  className="max-w-[8.5rem] text-right text-[10px] font-normal leading-snug text-muted-foreground"
                  data-ladder-untested-hint="true"
                  data-ladder-unproven-note="true"
                >
                  {unprovenNote}
                </p>
              ) : null}
            </div>
          </div>
          {!unplayed ? (
            <p className="mt-0.5 text-xs text-muted-foreground" data-ladder-record={`${row.wins}-${row.losses}`}>
              {form}
              {lastLine ? ` · ${lastLine}` : ""}
            </p>
          ) : null}
          {deltaLabel ? (
            <p
              className={cn(
                "mt-0.5 text-[11px] font-medium tabular-nums",
                deltaUp ? "text-emerald-600" : deltaDown ? "text-rose-600" : "text-muted-foreground",
              )}
              data-ladder-delta-label="true"
            >
              {deltaLabel}
            </p>
          ) : null}
        </div>
      </div>
      {selfRow ? (
        <span
          className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
          data-ladder-self-badge="true"
        >
          {t("friends.matchYou")}
        </span>
      ) : (
        <button
          type="button"
          data-ladder-challenge={row.id}
          disabled={busy}
          onClick={onChallenge}
          className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {t("friends.matchChallenge")}
        </button>
      )}
    </div>
  );
}

void CITY_STORAGE_KEY;
