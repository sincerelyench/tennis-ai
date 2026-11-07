"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startJobWatch } from "@/lib/job-watch";
import { readCoachId } from "@/lib/coach-roster";

/**
 * Open /analysis?job=<id> (or /analysis/new?job=<id>) in the in-app UI.
 * Starts the existing /tai job watcher (sslip GPU stack behind nginx /tai)
 * and routes to /analysis/new so progress → report stays on-site.
 */
export function AnalysisJobDeeplink({ children }: { children: ReactNode }) {
  const search = useSearchParams();
  const router = useRouter();
  const handled = useRef("");

  useEffect(() => {
    const job = (search?.get("job") || "").trim();
    if (!job || handled.current === job) return;
    handled.current = job;
    startJobWatch({
      jobId: job,
      levelId: "",
      strokeId: "",
      fileName: "",
      title: "网球挥拍测评",
      phase: "running",
      coachId: readCoachId(),
    });
    router.replace("/analysis/new");
  }, [search, router]);

  return <>{children}</>;
}
