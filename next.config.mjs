// Phase 4b: Hostinger Premium has no Node.js runtime, so production is a static export (out/) served by
// Apache. `npm run build:static` sets STATIC_EXPORT=1; `next dev` and `next build` keep the server mode
// while Phases 5-7 still have server code.
const staticExport = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  ...(staticExport ? { output: "export", trailingSlash: true } : {}),
  // Interim static check only (scripts/check-static-build.mjs swaps Phase 5-7 actions for untyped stubs).
  ...(process.env.STATIC_CHECK === "1" ? { typescript: { ignoreBuildErrors: true } } : {}),
  // Server Actions that still take files (staff paperwork, field-case photos, chat attachments).
  // Vercel caps a function request at 4.5 MB, so larger customer uploads go straight to storage.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Landing page photos: public showroom media from the Laravel API's `public` disk (only /storage/**, never
  // the signed private-file route), and stock photos from Unsplash.
  images: {
    // Static export has no image optimizer; files are served as uploaded (already compressed client-side).
    unoptimized: staticExport,
    remotePatterns: [
      (() => {
        const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
        return {
          protocol: api.protocol.replace(":", ""),
          hostname: api.hostname,
          port: api.port,
          pathname: "/storage/**",
        };
      })(),
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // The client shares the landing-page link as /auth/v1; only login/ and register/ have pages.
  // (Static export: the same redirect is an Apache rule, see src/lib/routing/htaccess.ts.)
  ...(staticExport
    ? {}
    : {
        async redirects() {
          return [{ source: "/auth/v1", destination: "/auth/v1/login", permanent: false }];
        },
      }),
};

export default nextConfig;
