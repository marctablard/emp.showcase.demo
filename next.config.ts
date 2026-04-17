import type { NextConfig } from 'next';
import createNextIntlSplitPlugin from 'next-intl-split/plugin';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnvVars } from './src/platform/healthcheck/env-validation';

/** Directory that contains this config file (= real app root). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// ── Tier 1: Build-time environment variable validation ──────────────────────
// Runs during `next build`. Fails the build if required vars are missing.
// console.* is acceptable here — this is build toolchain, not application runtime.
const envResult = validateEnvVars();

if (envResult.hasErrors) {
  const missing = envResult.items
    .filter((i) => !i.passed && i.severity === 'error')
    .map((i) => `  ✗ ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console -- build toolchain, LoggerService not available
  console.error(`\n[healthcheck] Missing required environment variables:\n${missing}\n`);
  throw new Error('Build aborted: missing required environment variables. See errors above.');
}

if (envResult.hasWarnings) {
  const warnings = envResult.items
    .filter((i) => !i.passed && i.severity === 'warning')
    .map((i) => `  ⚠ ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console -- build toolchain, LoggerService not available
  console.warn(`\n[healthcheck] Missing optional environment variables:\n${warnings}\n`);
}

if (!envResult.hasErrors && !envResult.hasWarnings) {
  // eslint-disable-next-line no-console -- build toolchain, LoggerService not available
  console.info('[healthcheck] ✓ All required environment variables are present');
}

let outputMode = undefined;
switch (process.env.NEXT_SERVER_OUTPUTMODE) {
  case 'standalone':
    outputMode = process.env.NEXT_SERVER_OUTPUTMODE;
    break;
  case 'export':
    throw new Error(
      'NEXT_SERVER_OUTPUTMODE=export is not supported for this application. The storefront relies on App Router SSR, middleware, and route handlers that require the Next.js server runtime.',
    );
}

let nextConfig: NextConfig = {
  // When another package-lock.json exists above this repo (e.g. ~/package-lock.json), Turbopack
  // can infer the wrong workspace root and resolve `tailwindcss` / `next-intl` from the parent
  // tree instead of this project's node_modules — breaking `next dev` with bogus module-not-found.
  turbopack: {
    root: projectRoot,
  },
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
