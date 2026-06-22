import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.36"],
  devIndicators: process.env.NEXT_DISABLE_DEV_INDICATORS === "1" ? false : undefined,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
