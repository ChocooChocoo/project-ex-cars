/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Server Actions that still take files (staff paperwork, field-case photos, chat attachments).
  // Vercel caps a function request at 4.5 MB, so larger customer uploads go straight to storage.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Landing page photos: public showroom media from the Laravel API's `public` disk (only /storage/**, never
  // the signed private-file route), and stock photos from Unsplash.
  images: {
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
  async redirects() {
    // The client shares the landing-page link as /auth/v1; only login/ and register/ have pages.
    return [{ source: "/auth/v1", destination: "/auth/v1/login", permanent: false }];
  },
};

export default nextConfig;
