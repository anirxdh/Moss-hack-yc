import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // livekit-server-sdk and @livekit/protocol are server-only Node packages
  // (protobuf + node:crypto). Mark them external so the bundler loads them as
  // native node modules instead of trying to bundle them into the /api/token
  // route handler — bundling them is what produces the empty-body 500.
  serverExternalPackages: ['livekit-server-sdk', '@livekit/protocol'],
  // Ensure the vendored IRS template ships with the /api/generate-1040 bundle
  // in standalone/production output (dev reads it from disk directly).
  outputFileTracingIncludes: {
    '/api/generate-1040': ['app/api/generate-1040/f1040-2025.pdf'],
  },
};

export default nextConfig;
