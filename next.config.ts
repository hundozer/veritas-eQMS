import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Static policy without nonces: Next.js needs inline scripts for hydration.
// Config headers replace a route's own header of the same name, so the PDF
// viewer, which sets its own stricter policy, is excluded from this one.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // Direct uploads go from the browser to the Vercel Blob API (DEC-068).
  "connect-src 'self' https://vercel.com/api/blob/",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const allPathsSource = "/(.*)";
const cspSource = "/:path((?!api/documents/[^/]+/pdf$).*)";
// The viewer embeds the verified file from its own path (?raw=true), so that one
// path may be framed by this origin; every other path stays DENY.
const pdfViewerSource = "/api/documents/:id/pdf";

const contentSecurityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: allPathsSource, headers: securityHeaders },
      { source: cspSource, headers: contentSecurityHeaders },
      // Later rules override earlier ones for the same header key.
      { source: pdfViewerSource, headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
