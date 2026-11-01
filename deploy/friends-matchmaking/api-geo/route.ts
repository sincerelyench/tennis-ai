import { json, preflight } from "@/lib/auth-http";
import { DEFAULT_CITY_ID, getCity, matchCityFromGeo } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const real = request.headers.get("x-real-ip") || "";
  const cf = request.headers.get("cf-connecting-ip") || "";
  const raw = (cf || real || forwarded.split(",")[0] || "").trim();
  if (!raw || raw === "127.0.0.1" || raw === "::1") return "";
  return raw.replace(/^::ffff:/, "");
}

type GeoPayload = {
  city?: string;
  regionName?: string;
  region?: string;
  countryCode?: string;
  status?: string;
};

async function lookupIp(ip: string): Promise<GeoPayload | null> {
  if (!ip) return null;
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,countryCode,regionName,region,city`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoPayload;
    if (data.status && data.status !== "success") return null;
    return data;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  // Prefer edge/CDN city headers when present
  const headerCity =
    request.headers.get("cf-ipcity") ||
    request.headers.get("x-vercel-ip-city") ||
    request.headers.get("x-city") ||
    "";
  const headerRegion = request.headers.get("cf-region") || request.headers.get("x-vercel-ip-country-region") || "";
  const headerCountry =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    "";

  let city = headerCity;
  let region = headerRegion;
  let countryCode = headerCountry;
  let source: "header" | "ip-api" | "default" = headerCity ? "header" : "default";

  if (!city) {
    const ip = clientIp(request);
    const geo = await lookupIp(ip);
    if (geo) {
      city = geo.city || "";
      region = geo.regionName || geo.region || "";
      countryCode = geo.countryCode || "";
      source = "ip-api";
    }
  }

  const matched = matchCityFromGeo({ city, region, countryCode });
  const cityId = matched?.id || DEFAULT_CITY_ID;
  const catalog = getCity(cityId);

  return json(request, {
    cityId,
    city: catalog?.en || city || "",
    cityZh: catalog?.zh || city || "",
    region,
    countryCode: catalog?.countryCode || countryCode || "",
    source,
    matched: Boolean(matched),
  });
}
