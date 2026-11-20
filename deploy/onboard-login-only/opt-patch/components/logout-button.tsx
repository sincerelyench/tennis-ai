"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

const basePath = "/tennis";

export function LogoutButton() {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        data-dom-id="logout-link"
        disabled={pending}
        className="h-auto w-full gap-2 rounded-md border-border bg-card py-3 text-sm font-semibold text-destructive hover:bg-muted"
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            // ZQ-165: credentials + hard navigation so cookie clear always sticks
            const response = await fetch(`${basePath}/api/auth/logout`, {
              method: "POST",
              credentials: "include",
            });
            if (!response.ok) {
              setError(t("profile.signOutFail"));
              setPending(false);
              return;
            }
          } catch {
            setError(t("profile.signOutFail"));
            setPending(false);
            return;
          }
          try {
            window.localStorage.removeItem("tennis-ai-role");
          } catch {
            /* ignore */
          }
          window.location.assign(`${basePath}/login`);
        }}
      >
        <LogOut className="size-4" />
        {pending ? t("profile.signingOut") : t("profile.signOut")}
      </Button>
      {error ? <p className="text-center text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
