import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/admin",
        destination: "/exam/admin",
      },
      {
        source: "/admin/:path*",
        destination: "/exam/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
