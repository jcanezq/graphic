/** @type {import('next').NextConfig} */

// Política de seguridad de contenido, en modo SOLO REPORTE.
// Está calibrada contra lo que la app usa hoy:
//  - Google Fonts entra por @import en src/app/globals.css -> style-src googleapis + font-src gstatic
//  - Supabase (REST, Storage, Realtime) -> connect-src https+wss *.supabase.co
//  - Avatares de Google -> img-src lh3.googleusercontent.com
//  - jspdf arma imágenes con data:/blob: -> img-src data: blob:
//  - El App Router inyecta scripts inline y el código usa style={{...}} por todos lados,
//    de ahí 'unsafe-inline'. Quitarlo exige nonces y es trabajo de otra fase.
// NO promover a Content-Security-Policy (modo bloqueo) sin las pruebas de T10.b.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: cspReportOnly },
];

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
