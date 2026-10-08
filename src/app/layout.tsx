import type { Metadata } from "next";
import "./globals.css";
import "@/ui/styles/liquid-glass.css";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
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
        {/* Collects MUI styles during server rendering so they match on hydration. */}
        <AppRouterCacheProvider>
          <UIThemeProvider defaultMode="dark" storageKey="theme-mode">
            {children}
          </UIThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
