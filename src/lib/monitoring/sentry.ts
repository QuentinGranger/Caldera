import { scrubBreadcrumb, scrubEvent } from './scrub';

// The DSN is public (it ships to browsers); one variable serves server and client.
// Without it, or outside a production build, Sentry stays off.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === 'production' &&
    Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // 10 % of requests traced: enough for trends within the free quota.
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
