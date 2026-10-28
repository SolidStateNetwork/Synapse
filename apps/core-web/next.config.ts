import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
