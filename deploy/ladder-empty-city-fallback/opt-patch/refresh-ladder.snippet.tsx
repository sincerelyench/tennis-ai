  async function refreshLadder() {
    // ZQ-163: empty city filter → DEFAULT_CITY_ID (wuxi) then unscoped; persist city.
    // Mirrors prod hotpatch (BUILD_ID=TYkmlLDQzDJPdqlLUFLE5).
    try {
      async function fetchLadderRows(cid: string): Promise<LadderApiRow[] | null> {
        const q = new URLSearchParams({ format });
        if (cid) q.set("cityId", cid);
        const res = await fetch(`/tennis/api/friends/ladder?${q}`, { credentials: "include" });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          rows?: LadderApiRow[];
          count?: number;
          empty?: boolean;
        };
        return Array.isArray(data.rows) ? data.rows : [];
      }

      let rows = await fetchLadderRows(cityId || "");
      if (rows === null) {
        setLadderFromApi(false);
        return;
      }

      // City scoped empty → try default city (wuxi) with players.
      if (rows.length === 0 && cityId && cityId !== DEFAULT_CITY_ID) {
        const fallback = await fetchLadderRows(DEFAULT_CITY_ID);
        if (fallback && fallback.length > 0) {
          setCityId(DEFAULT_CITY_ID);
          setCitySource("default");
          persistCityId(DEFAULT_CITY_ID);
          rows = fallback;
        }
      }

      // Still empty → unscoped ladder (same format) so UI is not blank when DB has people.
      if (rows.length === 0 && cityId) {
        const unscoped = await fetchLadderRows("");
        if (unscoped && unscoped.length > 0) {
          rows = unscoped;
        }
      }

      setLadderRows(rows);
      setLadderFromApi(true);
    } catch {
      setLadderFromApi(false);
    }
  }
