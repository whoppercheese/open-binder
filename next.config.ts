import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  images: {
    localPatterns: [
      {
        pathname: "/api/images/**",
      },
      {
        pathname: "/api/set-images/**",
      },
    ],
    remotePatterns: [],
    unoptimized: false,
  },
};

export default nextConfig;
