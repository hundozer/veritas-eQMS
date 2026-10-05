import type { Metadata } from "next";
import "./globals.css";
import "@/ui/styles/liquid-glass.css";
import { UIThemeProvider } from "@/ui";

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
    <html lang="en" data-theme="dark">
      <body>
        <UIThemeProvider defaultMode="dark" storageKey="theme-mode">
          {children}
        </UIThemeProvider>
      </body>
    </html>
  );
}
