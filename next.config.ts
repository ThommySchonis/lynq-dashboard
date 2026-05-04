import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-admin-email" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/dashboard.html", destination: "/home", permanent: true },
    ];
  },
};

export default nextConfig;
