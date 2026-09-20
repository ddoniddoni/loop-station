import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StudioTheme } from "@/components/ui/studio-theme";
import { ko } from "@/lib/i18n/ko";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: ko.appName,
  description: ko.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <StudioTheme>{children}</StudioTheme>
      </body>
    </html>
  );
}
