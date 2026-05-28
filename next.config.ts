import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading the dev server over the LAN IP (e.g. from a phone, or by typing the
  // Network URL). Next 16 blocks /_next dev resources for non-localhost origins by
  // default, which otherwise leaves the page stuck on the SSR "Loading…" shell.
  allowedDevOrigins: ["192.168.1.2"],
};

export default nextConfig;
