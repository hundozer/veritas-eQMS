import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/ui/styles/liquid-glass.css";
import { UIThemeProvider } from "@/ui";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veritas eQMS | GxP Document & Training Hub",
  description: "Compliance-ready eQMS platform for early biotech SaaS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} data-theme="dark">
      <body>
        <UIThemeProvider defaultMode="dark" storageKey="theme-mode">
          {children}
        </UIThemeProvider>
      </body>
    </html>
  );
}
