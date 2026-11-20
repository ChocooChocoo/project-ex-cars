import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Apache handles role-prefixed URLs on the deployed export. Keep those URLs usable in next dev too.
function devRouting() {
  const { STAFF_ROLES, SUPER_ADMIN_ROLE } = require("./src/lib/auth/roles.ts");
  const staff = [...STAFF_ROLES, SUPER_ADMIN_ROLE].join("|");
  return {
    async redirects() {
      return [
        { source: "/auth/v1", destination: "/auth/v1/login", permanent: false },
        {
          source: "/profile",
          has: [{ type: "cookie", key: "gce-role", value: `(?<role>customer|${staff})` }],
          destination: "/:role/profile",
          permanent: false,
        },
      ];
    },
    async rewrites() {
      return [
        { source: `/:role(${staff})`, destination: "/dashboard" },
        { source: `/:role(${staff})/recommendations`, destination: "/staff-recommendations" },
        // Deployed, Apache rewrites /dashboard/... by the gce-role cookie; mirror that here so a staff page
        // that links to /dashboard/transactions/<id> works in next dev too.
        { source: "/dashboard/:path*", destination: "/:path*" },
        { source: `/:role(${staff})/:path*`, destination: "/:path*" },
        { source: "/customer/profile", destination: "/my-profile" },
        { source: "/customer/inquiries/:path*", destination: "/my-inquiries/:path*" },
        { source: "/customer/:path*", destination: "/:path*" },
        { source: "/supplier/portal/:path*", destination: "/portal/:path*" },
        { source: "/supplier/portal", destination: "/portal" },
      ];
    },
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Landing page photos: public showroom media from the Laravel API's `public` disk (only /storage/**, never
  // the signed private-file route), and stock photos from Unsplash.
  images: {
    // Static export has no image optimizer; files are served as uploaded (already compressed client-side).
    unoptimized: true,
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
};

export default (phase) => ({
  ...nextConfig,
  ...(phase === PHASE_DEVELOPMENT_SERVER ? devRouting() : { output: "export", trailingSlash: true }),
});
