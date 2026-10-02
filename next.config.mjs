/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Server Actions that still take files (staff paperwork, field-case photos, chat attachments).
  // Vercel caps a function request at 4.5 MB, so larger customer uploads go straight to storage.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
