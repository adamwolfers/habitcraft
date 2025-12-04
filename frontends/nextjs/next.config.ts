import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for production Docker builds
};

export default nextConfig;
