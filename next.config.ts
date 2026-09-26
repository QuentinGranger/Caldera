import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Uploaded media are immutable (unique names); public/ files carry no
    // long-lived Cache-Control, so a replaced file shows within a week.
    minimumCacheTTL: 604800,
  },
  // content/**/*.md is read at request time (src/lib/content): ship it with
  // every server function. '/**' also matches the root route, '/*' does not.
  outputFileTracingIncludes: { '/**': ['./content/**/*.md'] },
};

// Organisation, project and token come from SENTRY_ORG, SENTRY_PROJECT and
// SENTRY_AUTH_TOKEN. Source maps are only generated when they can be uploaded,
// then deleted from the build: they are never served publicly.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
