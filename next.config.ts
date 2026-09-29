import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose the API at the same paths as the spec: /v1/accounts, /v1/trading/…
  async rewrites() {
    return [{ source: "/v1/:path*", destination: "/api/v1/:path*" }];
  },
  serverExternalPackages: [],
};

export default nextConfig;
