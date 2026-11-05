"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { refreshSessionProfile, useSessionRole } from "@/lib/session-role";
import {
  CITY_STORAGE_KEY,
  DEFAULT_CITY_ID,
  citiesForLocale,
  cityLabel,
  getCity,
  loadStoredCityId,
  matchCityFromGeo,
  persistCityId,
} from "@/lib/cities";

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

/**
 * Blocking gate after signup/login when display name or city is missing.
 * Persists both via PATCH /api/auth/profile (Postgres-backed).
 */
export function ProfileSetup() {
  const { t, locale } = useI18n();
  const session = useSessionRole();
  const cityOptions = useMemo(() => citiesForLocale(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState(DEFAULT_CITY_ID);
  const [cityReady, setCityReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session.phone) {
      setOpen(false);
      return;
    }
    const needs = !session.displayName.trim() || !session.cityId.trim();
    setOpen(needs);
    if (needs && session.displayName) setName(session.displayName);
  }, [session.phone, session.displayName, session.cityId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const fromAuth = String(session.cityId || "").trim();
      if (fromAuth && cityOptions.some((c) => c.id === fromAuth)) {
        if (!cancelled) {
          setCityId(fromAuth);
          persistCityId(fromAuth);
          setCityReady(true);
        }
        return;
      }
      const stored = loadStoredCityId();
      if (stored && cityOptions.some((c) => c.id === stored)) {
        if (!cancelled) {
          setCityId(stored);
          setCityReady(true);
        }
        return;
      }
      const detected = await detectCityFromIp(locale);
      if (!cancelled) {
        setCityId(detected);
        setCityReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, locale, cityOptions, session.cityId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      data-profile-setup="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <BrandMark size={28} className="size-7 shrink-0" />
          <p className="truncate text-base font-bold text-foreground">{t("brand")}</p>
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">{t("profileSetup.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("profileSetup.lead")}</p>

        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const displayName = name.trim();
            if (!displayName) {
              setError(t("profileSetup.badName"));
              return;
            }
            if (!cityOptions.some((c) => c.id === cityId)) {
              setError(t("profileSetup.badCity"));
              return;
            }
            setError("");
            setPending(true);
            try {
              const res = await fetch("/tennis/api/auth/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName, cityId }),
              });
              const data = (await res.json()) as {
                error?: string;
                displayName?: string;
                cityId?: string;
                needsProfileSetup?: boolean;
              };
              if (!res.ok) {
                setError(data.error || t("profileSetup.saveFail"));
                setPending(false);
                return;
              }
              const savedCity = String(data.cityId || cityId);
              persistCityId(savedCity);
              try {
                window.localStorage.setItem(CITY_STORAGE_KEY, savedCity);
              } catch {
                /* ignore */
              }
              await refreshSessionProfile();
              if (data.needsProfileSetup) {
                setError(t("profileSetup.saveFail"));
                setPending(false);
                return;
              }
              setOpen(false);
            } catch {
              setError(t("profileSetup.saveFail"));
              setPending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="profile-setup-name">{t("profileSetup.name")}</Label>
            <Input
              id="profile-setup-name"
              data-profile-setup-name="true"
              autoComplete="nickname"
              placeholder={t("profileSetup.namePh")}
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              className="h-10 bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-setup-city">{t("profileSetup.city")}</Label>
            <select
              id="profile-setup-city"
              data-profile-setup-city="true"
              value={cityId}
              disabled={!cityReady || pending}
              onChange={(e) => setCityId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
            >
              {cityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {cityLabel(c, locale)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {t("profileSetup.cityHint", {
                city: cityLabel(getCity(cityId) || { id: cityId, zh: cityId, en: cityId, countryCode: "", aliases: [] }, locale),
              })}
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive" data-profile-setup-error="true">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-10 w-full"
            disabled={pending || !cityReady}
            data-profile-setup-submit="true"
          >
            {pending ? t("profileSetup.saving") : t("profileSetup.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
