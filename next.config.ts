import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions をMVPで多用する
    serverActions: {},
  },
};

export default nextConfig;

