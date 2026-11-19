import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-4">
          <BrandMark size={32} className="size-8 shrink-0" />
          <span className="text-lg font-bold text-foreground">涨球乐</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
