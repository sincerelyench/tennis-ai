import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession, sessionCookie } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

async function readSessionToken() {
  try {
    const jar = await cookies();
    const fromJar = jar.get(sessionCookie)?.value;
    if (fromJar) return fromJar;
  } catch {
    /* cookies() can throw in rare contexts */
  }
  try {
    const raw = (await headers()).get("cookie") || "";
    const re = new RegExp(`(?:^|;\\s*)${sessionCookie}=([^;]+)`);
    const m = raw.match(re);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }
  return "";
}

export default async function MainLayout({ children }: { children: ReactNode }) {
  const token = await readSessionToken();
  if (!getSession(token)) {
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
