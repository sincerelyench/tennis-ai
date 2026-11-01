import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import type { MatchRecord } from "@/lib/match-demo";

export type MatchShare = {
  id: string;
  createdAt: string;
  ownerLabel: string;
  match: MatchRecord;
  coachReviewOpen: boolean;
};

function dir() {
  return path.join(process.env.TENNIS_DATA_DIR || path.join(process.cwd(), ".data"), "match-shares");
}

function fileFor(id: string) {
  return path.join(dir(), `${id}.json`);
}

export function saveMatchShare(input: {
  ownerLabel: string;
  match: MatchRecord;
  coachReviewOpen?: boolean;
}) {
  mkdirSync(dir(), { recursive: true });
  const id = randomBytes(5).toString("hex");
  const share: MatchShare = {
    id,
    createdAt: new Date().toISOString(),
    ownerLabel: input.ownerLabel || "球员",
    match: input.match,
    coachReviewOpen: input.coachReviewOpen !== false,
  };
  writeFileSync(fileFor(id), JSON.stringify(share));
  return share;
}

export function readMatchShare(id: string) {
  if (!/^[a-f0-9]{6,16}$/i.test(id)) return null;
  try {
    return JSON.parse(readFileSync(fileFor(id), "utf8")) as MatchShare;
  } catch {
    return null;
  }
}
