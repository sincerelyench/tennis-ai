/**
 * Shared board between players and network coaches.
 * Player leaves requests; logged-in network coach leaves guidance notes.
 */

export type BoardFrom = "student" | "coach";

export type NetworkBoardMessage = {
  id: string;
  text: string;
  at: string;
  from: BoardFrom;
  status?: "pending" | "replied";
  kind?: "video-guidance" | "note" | "guidance";
  jobId?: string;
  /** Soft identity for coach → student targeting (display name or phone). */
  studentKey?: string;
  studentLabel?: string;
};

const MSG_KEY = "tennis-network-coach-messages-v1";

function emptyAll(): Record<string, NetworkBoardMessage[]> {
  return {};
}

function readAll(): Record<string, NetworkBoardMessage[]> {
  if (typeof window === "undefined") return emptyAll();
  try {
    const raw = window.localStorage.getItem(MSG_KEY);
    if (!raw) return emptyAll();
    const parsed = JSON.parse(raw) as Record<string, NetworkBoardMessage[]>;
    if (!parsed || typeof parsed !== "object") return emptyAll();
    return parsed;
  } catch {
    return emptyAll();
  }
}

function writeAll(all: Record<string, NetworkBoardMessage[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MSG_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function normalize(item: Partial<NetworkBoardMessage> & { text: string }): NetworkBoardMessage {
  return {
    id: item.id || `m-${Date.now()}`,
    text: item.text.trim(),
    at: item.at || new Date().toISOString(),
    from: item.from === "coach" ? "coach" : "student",
    status: item.status || (item.from === "coach" ? "replied" : "pending"),
    kind: item.kind,
    jobId: item.jobId,
    studentKey: item.studentKey,
    studentLabel: item.studentLabel,
  };
}

export function readNetworkBoard(coachId: string): NetworkBoardMessage[] {
  if (!coachId) return [];
  const all = readAll();
  const list = Array.isArray(all[coachId]) ? all[coachId] : [];
  return list.map((row) =>
    normalize({
      ...row,
      // Legacy rows had no `from` — treat as student requests.
      from: row.from === "coach" ? "coach" : "student",
      text: row.text || "",
    }),
  );
}

export function writeNetworkBoard(coachId: string, list: NetworkBoardMessage[]) {
  if (!coachId) return;
  const all = readAll();
  all[coachId] = list.slice(-60).map((row) => normalize(row));
  writeAll(all);
}

export function appendNetworkBoard(
  coachId: string,
  item: Omit<NetworkBoardMessage, "id" | "at"> & { id?: string; at?: string },
): NetworkBoardMessage | null {
  const text = String(item.text || "").trim();
  if (!coachId || !text) return null;
  const next = normalize({ ...item, text });
  const list = [...readNetworkBoard(coachId), next];
  writeNetworkBoard(coachId, list);
  return next;
}

export function listBoardCoachIds(): string[] {
  return Object.keys(readAll()).filter((id) => Array.isArray(readAll()[id]) && readAll()[id].length > 0);
}

export function listStudentKeysForCoach(coachId: string): { key: string; label: string; count: number }[] {
  const map = new Map<string, { key: string; label: string; count: number }>();
  for (const row of readNetworkBoard(coachId)) {
    const key = row.studentKey || (row.from === "student" ? "default" : "");
    if (!key && row.from === "coach") continue;
    const useKey = key || "default";
    const label = row.studentLabel || (useKey === "default" ? "学员" : useKey);
    const prev = map.get(useKey) || { key: useKey, label, count: 0 };
    prev.count += 1;
    if (row.studentLabel) prev.label = row.studentLabel;
    map.set(useKey, prev);
  }
  if (map.size === 0) {
    return [{ key: "default", label: "学员", count: 0 }];
  }
  return [...map.values()];
}
