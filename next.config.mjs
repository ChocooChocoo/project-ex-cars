/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Server Actions that still take files (staff paperwork, field-case photos, chat attachments).
  // Vercel caps a function request at 4.5 MB, so larger customer uploads go straight to storage.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Landing page photos: showroom media from Supabase storage, and stock photos from Unsplash.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
