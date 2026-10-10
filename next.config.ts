import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Stop `next dev` from appending Next.js agent rules to CLAUDE.md; that file is project-owned.
  agentRules: false,
};

export default nextConfig;
