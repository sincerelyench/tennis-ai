import type { Metadata } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const noto = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "涨球",
    template: "%s · 涨球",
  },
  description: "涨球：视频分析、AI 教练、训练计划与约球，一站完成。",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Locale is resolved client-side in I18nProvider (cookie/localStorage/browser).
  // Avoid cookies() here — it forced every route (including /login) dynamic and
  // paid TTFB on each navigation for no server-rendered copy benefit.
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${noto.variable} light h-full antialiased`}
    >
      <body className="min-h-full">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
