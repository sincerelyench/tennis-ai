"use client";

import Link from "next/link";
import { useReports } from "@/lib/report-store";
import { pageClass } from "@/lib/data";
import { PageBack } from "@/components/page-back";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { displayWhen } from "@/lib/analysis";
import { displayGrade } from "@/lib/i18n/translate";

export function NoticesView() {
  const { t, locale } = useI18n();
  const reports = useReports();
  const ready = reports.find((item) => item.status === "done");
  const items = [
    ready
      ? {
          id: "n1",
          href: `/report/${ready.id}?from=analysis`,
          title: t("notices.ready"),
          detail: t("notices.readyDetail", { grade: displayGrade(locale, ready.grade || ready.rating) || "B", when: displayWhen(ready.when, locale) }),
        }
      : {
          id: "n1",
          href: "/analysis",
          title: t("notices.ready"),
          detail: t("notices.sampleReadyBody"),
        },
    // 每周训练 / 训练计划入口已从「我的」与通知移除
  ];

  return (
    <div className={pageClass} data-page="notices">
      <div>
        <PageBack fallback="/" label={t("common.back")} />
        <h1 className="text-base font-bold text-foreground">{t("notices.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("notices.lead")}</p>
      </div>
      {items.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {items.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              data-notice={item.id}
              className={`block px-4 py-3 hover:bg-muted ${index === items.length - 1 ? "" : "border-b border-border"}`}
            >
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title={t("notices.empty")} description={t("notices.emptyDesc")} />
      )}
    </div>
  );
}
