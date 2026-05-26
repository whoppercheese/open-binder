import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/collection",
        destination: "/collections",
        permanent: true,
      },
      {
        source: "/collection/:path*",
        destination: "/collections/:path*",
        permanent: true,
      },
    ];
  },
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
        pathname: "/**",
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
  },
};

export default nextConfig;
