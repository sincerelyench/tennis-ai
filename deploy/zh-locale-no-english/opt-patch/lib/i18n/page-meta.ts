import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "@/lib/i18n/translate";

/** Resolve UI locale for server metadata from the tennis-locale cookie. */
export async function localeFromCookie(): Promise<Locale> {
  const saved = (await cookies()).get("tennis-locale")?.value;
  return isLocale(saved) ? saved : "en";
}

/** Page title that follows zh/en — no English leftover when locale=zh. */
export async function pageTitle(titles: { en: string; zh: string }): Promise<Metadata> {
  const locale = await localeFromCookie();
  return { title: locale === "zh" ? titles.zh : titles.en };
}
