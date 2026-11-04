"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitch } from "@/components/language-switch";
import { Onboarding } from "@/components/onboarding";
import { useI18n } from "@/components/i18n-provider";
import { destForRole } from "@/lib/coach-home";
import { DEMO_COACH_PHONE, type UserRole } from "@/lib/role";
import { cn } from "@/lib/utils";

const basePath = "/tennis";

type ZhangqiuNative = {
  loginWithWeChat?: () => void;
};

declare global {
  interface Window {
    ZhangqiuNative?: ZhangqiuNative;
    __zqOnWeChatCode?: (code: string) => void;
    __zqOnWeChatError?: (message: string) => void;
  }
}

function isZhangqiuShell() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /ZhangqiuAndroid|ZhangqiuIOS/i.test(ua);
}

export function LoginView({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [wechatPending, setWechatPending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [role, setRole] = useState<UserRole>("player");
  const [shell, setShell] = useState(false);

  useEffect(() => {
    setShell(isZhangqiuShell());
  }, []);

  useEffect(() => {
    window.__zqOnWeChatCode = async (wxCode: string) => {
      const raw = String(wxCode || "").trim();
      if (!raw) {
        setWechatPending(false);
        setError(t("login.wechatFail"));
        return;
      }
      setError("");
      setWechatPending(true);
      try {
        const useApp =
          !raw.startsWith("apk_") &&
          !raw.startsWith("ios_") &&
          raw.length >= 10;
        const path = useApp ? "wechat-app" : "wechat";
        const client = /ZhangqiuIOS/i.test(navigator.userAgent || "")
          ? "ios"
          : "android";
        const response = await fetch(`${basePath}/api/auth/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code: raw, client, nickName: "" }),
        });
        const data = (await response.json()) as {
          error?: string;
          role?: UserRole;
        };
        if (!response.ok) {
          setError(
            data.error && !/[\u4e00-\u9fff]/.test(data.error)
              ? data.error
              : t("login.wechatFail"),
          );
          setWechatPending(false);
          return;
        }
        try {
          if (data.role) window.localStorage.setItem("tennis-ai-role", data.role);
        } catch {
          /* ignore */
        }
        router.push(destForRole(data.role, nextPath));
        router.refresh();
      } catch {
        setError(t("login.wechatFail"));
        setWechatPending(false);
      }
    };
    window.__zqOnWeChatError = (message: string) => {
      setWechatPending(false);
      setError(message || t("login.wechatFail"));
    };
    return () => {
      delete window.__zqOnWeChatCode;
      delete window.__zqOnWeChatError;
    };
  }, [nextPath, router, t]);

  async function sendCode() {
    if (countdown > 0 || sending) return;
    const number =
      phone.trim().toLowerCase() === "coach" || phone.trim().toLowerCase() === "coach@"
        ? DEMO_COACH_PHONE
        : phone.trim();
    if (!/^1\d{10}$/.test(number)) {
      setError(t("login.badPhone"));
      return;
    }
    if (number !== phone) setPhone(number);
    setError("");
    setSending(true);
    try {
      const response = await fetch(`${basePath}/api/auth/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number }),
      });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) {
        setError(
          data.error && !/[\u4e00-\u9fff]/.test(data.error)
            ? data.error
            : t("login.sendFail"),
        );
        return;
      }
      setHint(t("login.hint", { code: data.code }));
      setCountdown(60);
      const timer = window.setInterval(() => {
        setCountdown((current) => {
          if (current <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch {
      setError(t("login.sendFail"));
    } finally {
      setSending(false);
    }
  }

  function startWechatLogin() {
    if (wechatPending || pending) return;
    setError("");
    const native = window.ZhangqiuNative;
    if (native && typeof native.loginWithWeChat === "function") {
      setWechatPending(true);
      try {
        native.loginWithWeChat();
      } catch {
        setWechatPending(false);
        setError(t("login.wechatFail"));
      }
      return;
    }
    if (shell) {
      setError(t("login.wechatFail"));
      return;
    }
    setError(t("login.wechatWebHint"));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Onboarding />
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrandMark size={32} className="size-8" />
            <span className="text-lg font-bold text-foreground">{t("brand")}</span>
          </div>
          <LanguageSwitch compact />
        </div>
        <h1 className="text-xl font-bold text-foreground">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.lead")}</p>
        <div className="mt-4 flex gap-2" data-role-switch="true">
          <button
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              role === "player"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
            onClick={() => setRole("player")}
          >
            {t("common.player")}
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              role === "coach"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
            onClick={() => {
              setRole("coach");
              setPhone(DEMO_COACH_PHONE);
            }}
          >
            {t("common.coach")}
          </button>
        </div>
        {role === "coach" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("login.coachHint", { phone: DEMO_COACH_PHONE })}
          </p>
        ) : null}

        <div className="mt-6 space-y-3" data-wechat-login="true">
          <Button
            type="button"
            className="h-11 w-full bg-[#07c160] text-white hover:bg-[#06ad56]"
            disabled={wechatPending || pending}
            onClick={startWechatLogin}
          >
            {wechatPending ? t("login.wechatSubmitting") : t("login.wechat")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("login.orPhone")}</p>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const number =
              phone.trim().toLowerCase() === "coach" ||
              phone.trim().toLowerCase() === "coach@"
                ? DEMO_COACH_PHONE
                : phone.trim();
            if (!/^1\d{10}$/.test(number)) {
              setError(t("login.badPhone"));
              return;
            }
            if (!/^\d{4}$/.test(code.trim())) {
              setError(t("login.badCode"));
              return;
            }
            setError("");
            setPending(true);
            try {
              const response = await fetch(`${basePath}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: number, code: code.trim() }),
              });
              const data = (await response.json()) as {
                error?: string;
                role?: UserRole;
              };
              if (!response.ok) {
                setError(
                  data.error && !/[\u4e00-\u9fff]/.test(data.error)
                    ? data.error
                    : t("login.signFail"),
                );
                setPending(false);
                return;
              }
              try {
                if (data.role) window.localStorage.setItem("tennis-ai-role", data.role);
              } catch {
                /* ignore */
              }
              router.push(destForRole(data.role, nextPath));
              router.refresh();
              return;
            } catch {
              setError(t("login.signFail"));
              setPending(false);
              return;
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="phone">{t("login.phone")}</Label>
            <Input
              id="phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={t("login.phonePh")}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (error) setError("");
              }}
              aria-invalid={Boolean(error)}
              className="h-10 bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">{t("login.code")}</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("login.codePh")}
                value={code}
                maxLength={4}
                onChange={(event) => {
                  setCode(event.target.value);
                  if (error) setError("");
                }}
                className="h-10 bg-background"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                disabled={sending || countdown > 0}
                onClick={sendCode}
              >
                {countdown > 0 ? `${countdown}s` : t("login.getCode")}
              </Button>
            </div>
            {hint ? (
              <p className="text-xs text-muted-foreground">
                {hint}. {t("login.noText")}
              </p>
            ) : null}
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{t("login.errorTitle")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="h-10 w-full" disabled={pending || wechatPending}>
            {pending ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
