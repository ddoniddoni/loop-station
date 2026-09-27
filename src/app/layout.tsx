import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { StudioTheme } from "@/components/ui/studio-theme";
import { ko } from "@/lib/i18n/ko";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { AudioEngineProvider } from "@/components/audio/audio-engine-provider";
import { StudioViewProvider } from "@/components/studio/studio-view-provider";
import { StudioShell } from "@/components/studio/studio-shell";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Arial", "sans-serif"],
});

const geist = localFont({ src: "./fonts/GeistVariable.ttf", variable: "--font-geist", weight: "100 900", display: "swap", preload: false });
const jetbrains = localFont({ src: "./fonts/JetBrainsMonoVariable.ttf", variable: "--font-jetbrains", weight: "100 800", display: "swap", preload: false });

export const metadata: Metadata = {
  title: ko.appName,
  description: ko.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${geist.variable} ${jetbrains.variable}`}>
      <body>
        <StudioTheme><AudioEngineProvider><StudioViewProvider><StudioShell>{children}</StudioShell></StudioViewProvider></AudioEngineProvider></StudioTheme>
      </body>
    </html>
  );
}
