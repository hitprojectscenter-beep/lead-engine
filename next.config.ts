import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Twilio + pg are server-only; keep them out of the client bundle.
  serverExternalPackages: ["twilio", "pg"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
