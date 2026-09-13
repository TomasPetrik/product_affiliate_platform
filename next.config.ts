import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly. Without this, Turbopack's root
  // inference can walk up past this repo and pick up an unrelated
  // package.json/lockfile higher in the filesystem tree (e.g. in the
  // user's home directory), which otherwise only surfaces as a warning.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    // Baseline security headers. A full Content-Security-Policy is
    // intentionally deferred to the hardening phase (Phase 7), where it can
    // be tuned against real third-party script/image needs.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
