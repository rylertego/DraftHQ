import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.36"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
