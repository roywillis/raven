import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Design-system typeface: Inter (sans serif) by Rasmus Andersson, SIL Open Font License 1.1.
 * next/font downloads it at build time and serves it from this app, so browsers never call
 * Google Fonts.
 */
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Raven Reviewer Portal",
  description: "Human-in-the-loop review of borderline MSME credit applications.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
