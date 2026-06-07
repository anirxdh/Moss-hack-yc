import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // livekit-server-sdk and @livekit/protocol are server-only Node packages
  // (protobuf + node:crypto). Mark them external so the bundler loads them as
  // native node modules instead of trying to bundle them into the /api/token
  // route handler — bundling them is what produces the empty-body 500.
  serverExternalPackages: ['livekit-server-sdk', '@livekit/protocol'],
};

export default nextConfig;
