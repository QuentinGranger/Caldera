import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
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
