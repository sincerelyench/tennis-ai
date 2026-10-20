import { NextResponse } from "next/server";
import { listStarDemos, starDemoForStroke, preferredEmbed } from "@/lib/star-demos";

export const dynamic = "force-dynamic";

/** GET /tennis/api/star-demos?strokeId=fh-topspin — platform star catalog (no auth). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const strokeId = url.searchParams.get("strokeId") || "";
  const preferBili = url.searchParams.get("preferBilibili") !== "0";

  if (strokeId) {
    const demo = starDemoForStroke(strokeId);
    const src = preferredEmbed(demo, preferBili);
    return NextResponse.json({
      brand: "涨球",
      defaultCoach: "涨球教练",
      demo,
      embed: src,
    });
  }

  return NextResponse.json({
    brand: "涨球",
    defaultCoach: "涨球教练",
    demos: listStarDemos().map((d) => ({
      ...d,
      embed: preferredEmbed(d, preferBili),
    })),
  });
}
