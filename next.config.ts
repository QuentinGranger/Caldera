import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

// The OCR models and Tesseract's WebAssembly are read from disk, never
// downloaded: shipped with the supplier import pages only.
const ocrFiles = [
  './node_modules/@tesseract.js-data/fra/4.0.0_best_int/*',
  './node_modules/@tesseract.js-data/eng/4.0.0_best_int/*',
  './node_modules/tesseract.js/src/worker-script/**/*',
  './node_modules/tesseract.js-core/*.{js,wasm}',
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Uploaded media are immutable (unique names); public/ files carry no
    // long-lived Cache-Control, so a replaced file shows within a week.
    minimumCacheTTL: 604800,
  },
  // Supplier imports read PDFs and run OCR on the server: native canvas and
  // the Tesseract worker load files at run time, so they are not bundled.
  serverExternalPackages: ['@napi-rs/canvas', 'tesseract.js', 'unpdf'],
  // content/**/*.md is read at request time (src/lib/content): ship it with
  // every server function. '/**' also matches the root route, '/*' does not.
  // Turbopack matches the app path with its route group, webpack without.
  outputFileTracingIncludes: {
    '/**': ['./content/**/*.md'],
    '/admin/(dashboard)/fournisseurs/**': ocrFiles,
    '/admin/fournisseurs/**': ocrFiles,
  },
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
