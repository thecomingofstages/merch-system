import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are TypeScript source (docs/FRONTEND.md "Workspace layout").
  transpilePackages: ["@merch/ui", "@merch/shared"],
};

export default nextConfig;
