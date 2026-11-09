import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginView } from "@/components/login-view";
import { destForRole } from "@/lib/coach-home";
import { getSession, safeNext, sessionCookie } from "@/lib/auth-store";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Sign in", zh: "登录" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const jar = await cookies();
  const session = getSession(jar.get(sessionCookie)?.value);
  if (session) {
    redirect(destForRole(session.role, nextPath));
  }
  return <LoginView nextPath={nextPath} />;
}
