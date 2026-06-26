/** @type {import('next').NextConfig} */

// App-compatible Content-Security-Policy. Next + Tailwind inline styles and the
// (non-nonce) framework runtime need 'unsafe-inline'/'unsafe-eval' for scripts;
// the rest is tightened (object-src none, base-uri/form-action/frame-ancestors
// self) for defense-in-depth alongside React's auto-escaping.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://nominatim.openstreetmap.org https://api.openai.com https://api.cloudflare.com https://graph.facebook.com",
  "frame-src 'self' https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework/version.
  poweredByHeader: false,
  // Workspace package shipped as TypeScript source.
  transpilePackages: ["@event/db"],
  // Packages that must stay external to the server bundle.
  serverExternalPackages: ["pino", "@prisma/client", ".prisma/client", "bcryptjs"],
  // Lint is run explicitly via `npm run lint`; keep production builds fast.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
