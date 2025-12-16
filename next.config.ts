import type { NextConfig } from 'next';
import createNextIntlSplitPlugin from 'next-intl-split/plugin';

let outputMode = undefined;
switch (process.env.NEXT_SERVER_OUTPUTMODE) {
  case 'standalone':
  case 'export':
    outputMode = process.env.NEXT_SERVER_OUTPUTMODE;
    break;
}

let nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.storyblok.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },

  reactStrictMode: true,
  webpack: (config, { dev, isServer }) => {
    // Exclude test files from being compiled by Next.js
    config.module.rules.push({
      test: /\.test\.(js|jsx|ts|tsx)$/,
      use: 'ignore-loader',
    });

    return config;
  },
  headers: async () => {
    const headers = [];
    // Security headers for all routes
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: process.env.X_CONTENT_TYPE_OPTIONS || 'nosniff',
      },
      {
        key: 'Cross-Origin-Resource-Policy',
        value: process.env.CROSS_ORIGIN_RESOURCE_POLICY || 'same-site',
      },
      {
        key: 'Cross-Origin-Opener-Policy',
        value: process.env.CROSS_ORIGIN_OPENER_POLICY || 'same-origin',
      },
      {
        key: 'Referrer-Policy',
        value: process.env.REFERRER_POLICY || 'no-referrer',
      },
      {
        key: 'X-XSS-Protection',
        value: process.env.X_XSS_PROTECTION || '1; mode=block',
      },
    ];

    // Add HSTS header in production
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: process.env.STRICT_TRANSPORT_SECURITY || 'max-age=31536000; includeSubDomains; preload',
      });
    }

    headers.push({
      source: '/:path*',
      headers: securityHeaders,
    });

    // Robots meta tag for noindex
    if (process.env.NEXT_ROBOTS_NOINDEX === 'true') {
      headers.push({
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
      });
    }

    return headers;
  },
  output: outputMode,
};

// add i18n Logic to Next-Configuration
const withNextIntlSplit = createNextIntlSplitPlugin('./src/i18n/translations');

// Apply plugins in sequence
nextConfig = withNextIntlSplit(nextConfig);

export default nextConfig;
