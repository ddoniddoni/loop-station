import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { StudioTheme } from "@/components/ui/studio-theme";
import { ko } from "@/lib/i18n/ko";
import "@radix-ui/themes/styles.css";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: ko.appName,
  description: ko.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <StudioTheme>{children}</StudioTheme>
      </body>
    </html>
  );
}
