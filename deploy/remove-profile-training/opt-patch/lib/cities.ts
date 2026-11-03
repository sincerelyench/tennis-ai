/**
 * 涨球球友：城市目录与 IP 城市解析。
 * 中文 UI 仅展示中国城市；英文 UI 可展示全球城市。
 */

export type City = {
  id: string;
  /** zh display */
  zh: string;
  /** en display */
  en: string;
  countryCode: string; // CN, US, ...
  /** aliases for IP geo matching (lowercase) */
  aliases: string[];
};

/** China cities shown in zh picker (and always available in en). */
export const CHINA_CITIES: City[] = [
  { id: "beijing", zh: "北京", en: "Beijing", countryCode: "CN", aliases: ["beijing", "北京", "peking"] },
  { id: "shanghai", zh: "上海", en: "Shanghai", countryCode: "CN", aliases: ["shanghai", "上海"] },
  { id: "guangzhou", zh: "广州", en: "Guangzhou", countryCode: "CN", aliases: ["guangzhou", "广州", "canton"] },
  { id: "shenzhen", zh: "深圳", en: "Shenzhen", countryCode: "CN", aliases: ["shenzhen", "深圳"] },
  { id: "hangzhou", zh: "杭州", en: "Hangzhou", countryCode: "CN", aliases: ["hangzhou", "杭州"] },
  { id: "nanjing", zh: "南京", en: "Nanjing", countryCode: "CN", aliases: ["nanjing", "南京"] },
  { id: "suzhou", zh: "苏州", en: "Suzhou", countryCode: "CN", aliases: ["suzhou", "苏州"] },
  { id: "wuxi", zh: "无锡", en: "Wuxi", countryCode: "CN", aliases: ["wuxi", "无锡"] },
  { id: "chengdu", zh: "成都", en: "Chengdu", countryCode: "CN", aliases: ["chengdu", "成都"] },
  { id: "chongqing", zh: "重庆", en: "Chongqing", countryCode: "CN", aliases: ["chongqing", "重庆"] },
  { id: "wuhan", zh: "武汉", en: "Wuhan", countryCode: "CN", aliases: ["wuhan", "武汉"] },
  { id: "xian", zh: "西安", en: "Xi'an", countryCode: "CN", aliases: ["xi'an", "xian", "西安"] },
  { id: "tianjin", zh: "天津", en: "Tianjin", countryCode: "CN", aliases: ["tianjin", "天津"] },
  { id: "qingdao", zh: "青岛", en: "Qingdao", countryCode: "CN", aliases: ["qingdao", "青岛"] },
  { id: "xiamen", zh: "厦门", en: "Xiamen", countryCode: "CN", aliases: ["xiamen", "厦门", "amoy"] },
  { id: "changsha", zh: "长沙", en: "Changsha", countryCode: "CN", aliases: ["changsha", "长沙"] },
  { id: "zhengzhou", zh: "郑州", en: "Zhengzhou", countryCode: "CN", aliases: ["zhengzhou", "郑州"] },
  { id: "hefei", zh: "合肥", en: "Hefei", countryCode: "CN", aliases: ["hefei", "合肥"] },
  { id: "ningbo", zh: "宁波", en: "Ningbo", countryCode: "CN", aliases: ["ningbo", "宁波"] },
  { id: "dongguan", zh: "东莞", en: "Dongguan", countryCode: "CN", aliases: ["dongguan", "东莞"] },
  { id: "hongkong", zh: "香港", en: "Hong Kong", countryCode: "HK", aliases: ["hong kong", "hongkong", "香港"] },
  { id: "taipei", zh: "台北", en: "Taipei", countryCode: "TW", aliases: ["taipei", "台北", "taipei city"] },
];

/** Extra world cities for English picker. */
export const WORLD_CITIES: City[] = [
  { id: "newyork", zh: "纽约", en: "New York", countryCode: "US", aliases: ["new york", "new york city", "nyc", "纽约"] },
  { id: "losangeles", zh: "洛杉矶", en: "Los Angeles", countryCode: "US", aliases: ["los angeles", "la", "洛杉矶"] },
  { id: "london", zh: "伦敦", en: "London", countryCode: "GB", aliases: ["london", "伦敦"] },
  { id: "paris", zh: "巴黎", en: "Paris", countryCode: "FR", aliases: ["paris", "巴黎"] },
  { id: "tokyo", zh: "东京", en: "Tokyo", countryCode: "JP", aliases: ["tokyo", "东京"] },
  { id: "seoul", zh: "首尔", en: "Seoul", countryCode: "KR", aliases: ["seoul", "首尔", "ソウル"] },
  { id: "singapore", zh: "新加坡", en: "Singapore", countryCode: "SG", aliases: ["singapore", "新加坡"] },
  { id: "sydney", zh: "悉尼", en: "Sydney", countryCode: "AU", aliases: ["sydney", "悉尼"] },
  { id: "toronto", zh: "多伦多", en: "Toronto", countryCode: "CA", aliases: ["toronto", "多伦多"] },
  { id: "dubai", zh: "迪拜", en: "Dubai", countryCode: "AE", aliases: ["dubai", "迪拜"] },
  { id: "bangkok", zh: "曼谷", en: "Bangkok", countryCode: "TH", aliases: ["bangkok", "曼谷"] },
  { id: "berlin", zh: "柏林", en: "Berlin", countryCode: "DE", aliases: ["berlin", "柏林"] },
];

export const ALL_CITIES: City[] = [...CHINA_CITIES, ...WORLD_CITIES];

export const DEFAULT_CITY_ID = "wuxi";
export const CITY_STORAGE_KEY = "zq-friends-city-v1";

export function citiesForLocale(locale: string): City[] {
  const zh = locale.toLowerCase().startsWith("zh");
  return zh ? CHINA_CITIES : ALL_CITIES;
}

export function getCity(id: string | null | undefined): City | undefined {
  if (!id) return undefined;
  return ALL_CITIES.find((c) => c.id === id);
}

export function cityLabel(city: City, locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? city.zh : city.en;
}

/** Match IP geo city/region strings onto our catalog. */
export function matchCityFromGeo(input: {
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}): City | undefined {
  const raw = `${input.city || ""} ${input.region || ""}`.trim().toLowerCase();
  if (!raw && !input.countryCode) return undefined;

  const pool = ALL_CITIES;
  for (const c of pool) {
    for (const a of c.aliases) {
      if (raw === a || raw.includes(a) || a.includes(raw.split(/\s+/)[0] || "")) {
        if (raw.includes(a) || raw === a) return c;
      }
    }
  }
  // stricter second pass: exact alias token
  const tokens = raw.split(/[\s,/-]+/).filter(Boolean);
  for (const c of pool) {
    for (const a of c.aliases) {
      if (tokens.includes(a)) return c;
    }
  }
  return undefined;
}

export function loadStoredCityId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CITY_STORAGE_KEY);
    return v && getCity(v) ? v : null;
  } catch {
    return null;
  }
}

export function persistCityId(id: string) {
  try {
    localStorage.setItem(CITY_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
