#!/usr/bin/env bash
# ZQ-164b: do not paint「暂无球员(0)」when ladder/friends APIs 401/fail.
# Also refetch on tab visibility — soft-nav + stale cookie otherwise looks like empty DB.
set -euo pipefail

ROOT="${1:-${ROOT:-/opt/tennis-ai}}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.ladder-auth-empty-guard-backup-$STAMP"
TARGET="$ROOT/components/friends-view.tsx"
MSG="$ROOT/lib/i18n/messages.ts"

echo "==> Backup -> $BACKUP"
mkdir -p "$BACKUP/components" "$BACKUP/lib/i18n"
cp -a "$TARGET" "$BACKUP/components/" 2>/dev/null || true
cp -a "$MSG" "$BACKUP/lib/i18n/" 2>/dev/null || true

python3 - "$TARGET" "$MSG" <<'PY'
from pathlib import Path
import sys

fv_path = Path(sys.argv[1])
msg_path = Path(sys.argv[2])
src = fv_path.read_text()
if "ZQ-164b: ladderAuthError" in src and "visibilitychange" in src:
    print("friends-view already has ZQ-164b; skipping fv")
else:
    orig = src

    def once(old, new, label):
        global src
        if old not in src:
            raise SystemExit(f"MISSING {label}")
        if src.count(old) != 1:
            raise SystemExit(f"Ambiguous {label}: {src.count(old)}")
        src = src.replace(old, new, 1)
        print("ok", label)

    once(
        "  const [ladderFromApi, setLadderFromApi] = useState(false);",
        "  const [ladderFromApi, setLadderFromApi] = useState(false);\n"
        "  const [ladderAuthError, setLadderAuthError] = useState(false); // ZQ-164b: ladderAuthError\n"
        "  const [ladderFetchError, setLadderFetchError] = useState(false);",
        "state",
    )

    old_rl = '''  async function refreshLadder() {
    try {
      const load = async (cid: string) => {
        const q = new URLSearchParams({ format, cityId: cid || "" });
        const res = await fetch(`/tennis/api/friends/ladder?${q}`, { credentials: "include" });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          rows?: LadderApiRow[];
          count?: number;
          empty?: boolean;
        };
        return Array.isArray(data.rows) ? data.rows : [];
      };
      let rows = await load(cityId || "");
      if (rows === null) {
        setLadderFromApi(false);
        return;
      }
      // ZQ-163: city filter empty but DB has people — fall back to Wuxi then unscoped.
      if (rows.length === 0 && cityId) {
        if (cityId !== DEFAULT_CITY_ID) {
          const wuxi = await load(DEFAULT_CITY_ID);
          if (wuxi && wuxi.length > 0) {
            rows = wuxi;
            setCityId(DEFAULT_CITY_ID);
            persistCityId(DEFAULT_CITY_ID);
          }
        }
        if (rows.length === 0) {
          const all = await load("");
          if (all && all.length > 0) rows = all;
        }
      }
      setLadderRows(rows);
      setLadderFromApi(true);
    } catch {
      setLadderFromApi(false);
    }
  }'''

    new_rl = '''  async function refreshLadder() {
    try {
      const load = async (cid: string): Promise<{ rows: LadderApiRow[] | null; status: number }> => {
        const q = new URLSearchParams({ format, cityId: cid || "" });
        const res = await fetch(`/tennis/api/friends/ladder?${q}`, { credentials: "include" });
        if (!res.ok) return { rows: null, status: res.status };
        const data = (await res.json()) as {
          rows?: LadderApiRow[];
          count?: number;
          empty?: boolean;
        };
        return { rows: Array.isArray(data.rows) ? data.rows : [], status: res.status };
      };
      let loaded = await load(cityId || "");
      if (loaded.rows === null) {
        setLadderFromApi(false);
        setLadderAuthError(loaded.status === 401);
        setLadderFetchError(loaded.status !== 401);
        return;
      }
      let rows = loaded.rows;
      // ZQ-163: city filter empty but DB has people — fall back to Wuxi then unscoped.
      if (rows.length === 0 && cityId) {
        if (cityId !== DEFAULT_CITY_ID) {
          const wuxi = await load(DEFAULT_CITY_ID);
          if (wuxi.rows && wuxi.rows.length > 0) {
            rows = wuxi.rows;
            setCityId(DEFAULT_CITY_ID);
            persistCityId(DEFAULT_CITY_ID);
          }
        }
        if (rows.length === 0) {
          const all = await load("");
          if (all.rows && all.rows.length > 0) rows = all.rows;
        }
      }
      setLadderRows(rows);
      setLadderFromApi(true);
      setLadderAuthError(false);
      setLadderFetchError(false);
    } catch {
      setLadderFromApi(false);
      setLadderFetchError(true);
    }
  }'''
    once(old_rl, new_rl, "refreshLadder")

    once(
        '''  useEffect(() => {
    if (!cityReady) return;
    void refreshLadder();
    void refreshCityMatches();
  }, [format, cityId, cityReady, directoryCount]);
''',
        '''  useEffect(() => {
    if (!cityReady) return;
    void refreshLadder();
    void refreshCityMatches();
  }, [format, cityId, cityReady, directoryCount]);

  // ZQ-164b: soft-nav / background tab can keep a shell while APIs 401 — refetch on focus.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void refreshDirectory();
      void refreshScores();
      void refreshIntros();
      if (cityReady) {
        void refreshLadder();
        void refreshCityMatches();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [cityReady, format, cityId]);
''',
        "visibility",
    )

    once(
        '''        {ladder.length === 0 ? (
          <EmptyState title={t("friends.emptyRank")} description={t("friends.emptyRankCity", { city: cityName })} />
        ) : (''',
        '''        {ladder.length === 0 ? (
          ladderAuthError || ladderFetchError ? (
            <div
              className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center"
              data-ladder-load-error={ladderAuthError ? "auth" : "fetch"}
            >
              <p className="text-sm font-semibold text-foreground">
                {ladderAuthError ? t("friends.ladderAuthErrorTitle") : t("friends.ladderFetchErrorTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {ladderAuthError ? t("friends.ladderAuthErrorBody") : t("friends.ladderFetchErrorBody")}
              </p>
              <button
                type="button"
                className="mt-4 h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                data-ladder-retry="true"
                onClick={() => {
                  if (ladderAuthError) {
                    window.location.href = "/tennis/login?next=/ladder";
                    return;
                  }
                  void refreshLadder();
                  void refreshCityMatches();
                }}
              >
                {ladderAuthError ? t("friends.ladderAuthErrorCta") : t("friends.ladderFetchErrorCta")}
              </button>
            </div>
          ) : (
            <EmptyState title={t("friends.emptyRank")} description={t("friends.emptyRankCity", { city: cityName })} />
          )
        ) : (''',
        "empty-ui",
    )

    # debug attrs on ladder section
    once(
        '<section className="space-y-3" data-ladder={format} data-ladder-city={cityId}>',
        '<section className="space-y-3" data-ladder={format} data-ladder-city={cityId} data-ladder-from-api={ladderFromApi ? "true" : "false"} data-ladder-count={ladder.length} data-ladder-auth-error={ladderAuthError ? "true" : undefined}>',
        "data-attrs",
    )

    if src == orig:
        raise SystemExit("fv no change")
    fv_path.write_text(src)
    print("friends-view patched")

# messages
msg = msg_path.read_text()
if "ladderAuthErrorTitle" in msg:
    print("messages already have keys")
else:
    en_old = '      emptyRankCity: "No players in {city} (0).",'
    en_new = '''      emptyRankCity: "No players in {city} (0).",
      ladderAuthErrorTitle: "Session expired",
      ladderAuthErrorBody: "Sign in again to load the ladder and match records from the server.",
      ladderAuthErrorCta: "Sign in",
      ladderFetchErrorTitle: "Could not load ladder",
      ladderFetchErrorBody: "Check the network, then retry. This is not an empty city.",
      ladderFetchErrorCta: "Retry",'''
    zh_old = '      emptyRankCity: "{city} 暂无球员（0）。",'
    zh_new = '''      emptyRankCity: "{city} 暂无球员（0）。",
      ladderAuthErrorTitle: "登录已失效",
      ladderAuthErrorBody: "请重新登录后再看排行榜与约球记录（不是数据库空了）。",
      ladderAuthErrorCta: "去登录",
      ladderFetchErrorTitle: "排行榜加载失败",
      ladderFetchErrorBody: "请检查网络后重试。这不是「该城市没有人」。",
      ladderFetchErrorCta: "重试",'''
    if en_old not in msg or zh_old not in msg:
        raise SystemExit("messages anchors missing")
    msg = msg.replace(en_old, en_new, 1).replace(zh_old, zh_new, 1)
    msg_path.write_text(msg)
    print("messages patched")
PY

echo "==> Sanity"
grep -n "ZQ-164b\|ladderAuthError\|visibilitychange\|ladderAuthErrorTitle" "$TARGET" "$MSG" | head -40

echo "==> Rebuild"
cd "$ROOT"
if [[ -x "$ROOT/scripts/atomic-next-rebuild.sh" ]]; then
  bash "$ROOT/scripts/atomic-next-rebuild.sh"
else
  systemctl stop tennis-ai || true
  sudo -u tennis npx next build --webpack || sudo -u tennis npm run build
  systemctl start tennis-ai
fi
echo "BUILD_ID=$(cat "$ROOT/.next/BUILD_ID")"
echo "DONE ZQ-164b auth-empty guard"
