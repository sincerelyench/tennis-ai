"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AndroidApkLink } from "@/components/android-apk-hint";
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
  // APK / IPA WebView only — browser web must not show WeChat login.
  return /ZhangqiuAndroid|ZhangqiuIOS/i.test(ua);
}

function isZhangqiuAndroid() {
  if (typeof navigator === "undefined") return false;
  // ZQ-129: Android APK must not offer WeChat login (web already hides it).
  return /ZhangqiuAndroid/i.test(navigator.userAgent || "");
}

type AuthTab = "signin" | "signup";
type LoginMode = "password" | "phone";

export function LoginView({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { t } = useI18n();
  // New users land on Register first; Sign in is the secondary tab.
  const [authTab, setAuthTab] = useState<AuthTab>("signup");
  const [mode, setMode] = useState<LoginMode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
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
  const [androidShell, setAndroidShell] = useState(false);
  // WeChat login entry: IPA / mini-program paths may keep it; Android APK must not.
  const showWechatLogin = shell && !androidShell;

  useEffect(() => {
    setShell(isZhangqiuShell());
    setAndroidShell(isZhangqiuAndroid());
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
        const dest = destForRole(data.role, nextPath);
        if (typeof window !== "undefined") {
          window.location.assign(`/tennis${dest.startsWith("/") ? dest : `/${dest}`}`);
          return;
        }
        router.push(dest);
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
    // Web + Android APK never expose this button; IPA shell may still use it.
    if (!showWechatLogin || wechatPending || pending) return;
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
    setError(t("login.wechatFail"));
  }

  async function finishLogin(data: { role?: UserRole }) {
    try {
      if (data.role) window.localStorage.setItem("tennis-ai-role", data.role);
    } catch {
      /* ignore */
    }
    router.push(destForRole(data.role, nextPath));
    router.refresh();
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
          <div className="flex items-center gap-3" data-apk-hint-login="true">
            <AndroidApkLink />
            <LanguageSwitch compact />
          </div>
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {authTab === "signup" ? t("login.signupTitle") : t("login.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {authTab === "signup" ? t("login.signupLead") : t("login.lead")}
        </p>

        <div
          className="mt-4 flex gap-2"
          data-auth-tab="true"
          data-auth-default="signup"
        >
          <button
            type="button"
            data-auth-tab-signup="true"
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold",
              authTab === "signup"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
            onClick={() => {
              setAuthTab("signup");
              setMode("password");
              setError("");
              setHint("");
            }}
          >
            {t("login.tabSignUp")}
          </button>
          <button
            type="button"
            data-auth-tab-signin="true"
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold",
              authTab === "signin"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
            onClick={() => {
              setAuthTab("signin");
              setError("");
              setHint("");
            }}
          >
            {t("login.tabSignIn")}
          </button>
        </div>

        {authTab === "signin" ? (
          <>
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

            {showWechatLogin ? (
              <div className="mt-6 space-y-3" data-wechat-login="true">
                <Button
                  type="button"
                  className="h-11 w-full bg-[#07c160] text-white hover:bg-[#06ad56]"
                  disabled={wechatPending || pending}
                  onClick={startWechatLogin}
                >
                  {wechatPending ? t("login.wechatSubmitting") : t("login.wechat")}
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t("login.orAccount")}</p>
              </div>
            ) : null}

            <div
              className={cn("flex gap-2", showWechatLogin ? "mt-4" : "mt-6")}
              data-login-mode="true"
              data-apk-no-wechat-login={androidShell ? "true" : undefined}
            >
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-semibold",
                  mode === "password"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                onClick={() => {
                  setMode("password");
                  setError("");
                  setHint("");
                }}
              >
                {t("login.modePassword")}
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-semibold",
                  mode === "phone"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                onClick={() => {
                  setMode("phone");
                  setError("");
                }}
              >
                {t("login.modePhone")}
              </button>
            </div>

            {mode === "password" ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const name = username.trim();
                  if (name.length < 3) {
                    setError(t("login.badUsername"));
                    return;
                  }
                  if (password.length < 4) {
                    setError(t("login.badPassword"));
                    return;
                  }
                  setError("");
                  setPending(true);
                  try {
                    const response = await fetch(`${basePath}/api/auth/login`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ username: name, password }),
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
                    await finishLogin(data);
                    return;
                  } catch {
                    setError(t("login.signFail"));
                    setPending(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="username">{t("login.username")}</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder={t("login.usernamePh")}
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      if (error) setError("");
                    }}
                    aria-invalid={Boolean(error)}
                    className="h-10 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("login.passwordPh")}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError("");
                    }}
                    className="h-10 bg-background"
                  />
                  <p className="text-xs text-muted-foreground">{t("login.passwordHint")}</p>
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
            ) : (
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
                      credentials: "include",
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
                    await finishLogin(data);
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
            )}
          </>
        ) : (
          <form
            className="mt-6 space-y-4"
            data-signup-form="true"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = username.trim();
              if (!/^[a-zA-Z0-9_\-]{3,32}$/.test(name)) {
                setError(t("login.badSignupUsername"));
                return;
              }
              if (password.length < 4) {
                setError(t("login.badPassword"));
                return;
              }
              if (password !== password2) {
                setError(t("login.passwordMismatch"));
                return;
              }
              setError("");
              setPending(true);
              try {
                const response = await fetch(`${basePath}/api/auth/register`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ username: name, password }),
                });
                const data = (await response.json()) as {
                  error?: string;
                  role?: UserRole;
                };
                if (!response.ok) {
                  setError(
                    data.error && !/[\u4e00-\u9fff]/.test(data.error)
                      ? data.error
                      : t("login.signupFail"),
                  );
                  setPending(false);
                  return;
                }
                await finishLogin(data);
                return;
              } catch {
                setError(t("login.signupFail"));
                setPending(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="signup-username">{t("login.username")}</Label>
              <Input
                id="signup-username"
                data-signup-username="true"
                autoComplete="username"
                placeholder={t("login.signupUsernamePh")}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (error) setError("");
                }}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">{t("login.password")}</Label>
              <Input
                id="signup-password"
                data-signup-password="true"
                type="password"
                autoComplete="new-password"
                placeholder={t("login.passwordPh")}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password2">{t("login.passwordConfirm")}</Label>
              <Input
                id="signup-password2"
                data-signup-password2="true"
                type="password"
                autoComplete="new-password"
                placeholder={t("login.passwordConfirmPh")}
                value={password2}
                onChange={(event) => {
                  setPassword2(event.target.value);
                  if (error) setError("");
                }}
                className="h-10 bg-background"
              />
              <p className="text-xs text-muted-foreground">{t("login.signupHint")}</p>
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("login.signupErrorTitle")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="submit"
              className="h-10 w-full"
              disabled={pending}
              data-signup-submit="true"
            >
              {pending ? t("login.signupSubmitting") : t("login.signupSubmit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
