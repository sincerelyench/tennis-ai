import { NextResponse } from "next/server";
import { saveMatchShare } from "@/lib/match-share-store";
import type { MatchRecord } from "@/lib/match-demo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { match?: MatchRecord; ownerLabel?: string; coachReviewOpen?: boolean };
  try {
    body = (await req.json()) as { match?: MatchRecord; ownerLabel?: string; coachReviewOpen?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.match || !body.match.id || !Array.isArray(body.match.points)) {
    return NextResponse.json({ error: "match_required" }, { status: 400 });
  }
  const share = saveMatchShare({
    match: body.match,
    ownerLabel: body.ownerLabel || "球员",
    coachReviewOpen: body.coachReviewOpen !== false,
  });
  return NextResponse.json({
    id: share.id,
    url: `/tennis/share/m/${share.id}`,
    path: `/share/m/${share.id}`,
  });
}
