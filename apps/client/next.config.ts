import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are TypeScript source (docs/FRONTEND.md "Workspace layout").
  transpilePackages: ["@merch/ui", "@merch/shared"],
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
