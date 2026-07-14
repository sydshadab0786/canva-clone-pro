/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server bundle for a small production Docker image.
  output: 'standalone',
  compress: true,
  // A production `next build` writes to the same directory `next dev` serves
  // from, which silently breaks a running dev server (every chunk 404s and the
  // page renders unstyled). Verification builds set NEXT_DIST_DIR to keep the
  // two apart.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  webpack: (config) => {
    // Konva ships a Node build that optionally requires the native `canvas`
    // package for server-side rendering. We only use Konva client-side, so
    // stub it out to keep the bundle clean and the build green.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async headers() {
    // Baseline security headers; CSP is tightened per-route as features land.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
