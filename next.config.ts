import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    localPatterns: [
      {
        pathname: "/api/images/**",
      },
    ],
    remotePatterns: [],
    unoptimized: false,
  },
};

export default nextConfig;
