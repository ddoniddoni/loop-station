import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ko } from "@/lib/i18n/ko";
import "./globals.css";

export const metadata: Metadata = {
  title: ko.appName,
  description: ko.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
