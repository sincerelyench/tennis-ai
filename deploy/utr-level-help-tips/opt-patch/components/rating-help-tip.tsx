"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RatingHelpTipProps = {
  title: string;
  body: string;
  ariaLabel: string;
  /** data-help value for screenshots / tests */
  kind: "level" | "utr";
  className?: string;
};

/** Compact "?" control that opens meaning + algorithm copy for level / UTR. */
export function RatingHelpTip({
  title,
  body,
  ariaLabel,
  kind,
  className,
}: RatingHelpTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        data-help={kind}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] font-semibold leading-none text-muted-foreground transition hover:border-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        ?
      </button>
      <DialogContent
        className="sm:max-w-md"
        data-help-dialog={kind}
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle data-help-title={kind}>{title}</DialogTitle>
          <DialogDescription
            data-help-body={kind}
            className="max-h-[min(60vh,28rem)] overflow-y-auto whitespace-pre-line text-left leading-6 text-muted-foreground"
          >
            {body}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
