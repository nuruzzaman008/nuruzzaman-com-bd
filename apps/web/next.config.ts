import type { NextConfig } from 'next';

/**
 * Next.js 16 configuration.
 *
 * Turbopack is the default bundler for both `next dev` and `next build`, so no
 * flag is needed. The app is deployed as a long-running Node server behind
 * Nginx - static export is not an option because authentication, checkout and
 * the course player all need per-request rendering.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Media is served from the API host or from object storage; both are
    // declared explicitly rather than through the deprecated `domains` option.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nuruzzaman.com.bd',
        pathname: '/storage/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/storage/**',
      },
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [
            {
              protocol: 'https' as const,
              hostname: process.env.NEXT_PUBLIC_MEDIA_HOST,
              pathname: '/**',
            },
          ]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
    // A single quality keeps the optimiser cache small; 75 is the Next default.
    qualities: [75],
  },

  /**
   * Local-only stand-in for Nginx.
   *
   * In production Nginx serves the site, `/api` and `/sanctum` from one origin,
   * which is what makes the Sanctum session cookie and the CSRF handshake work.
   * Pointing the browser at a second origin instead breaks both: the cookie is
   * not sent, `/sanctum/csrf-cookie` 404s, and every write fails with a 419.
   *
   * Set NEXT_DEV_API_PROXY to the Laravel origin to reproduce the production
   * topology locally. It is unset in production, where Nginx does this.
   */
  async rewrites() {
    const target = process.env.NEXT_DEV_API_PROXY;

    if (!target) {
      return [];
    }

    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
      { source: '/sanctum/:path*', destination: `${target}/sanctum/:path*` },
    ];
  },

  /**
   * Permanent redirects for URLs that are advertised elsewhere but are not the
   * canonical address. Keeping them here rather than as duplicate pages means
   * there is exactly one indexable URL per thing.
   */
  async redirects() {
    return [
      {
        // The slug recommended in the owner's product document.
        source: '/nb-engineering-tools-autocad-structural-design-software',
        destination: '/engineering-tools',
        permanent: true,
      },
      {
        source: '/nb-engineering-tools',
        destination: '/engineering-tools',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
