import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/monitoring/sentry';

export function register() {
  Sentry.init(sentryOptions);
}

// Server Components, Route Handlers, Server Actions and proxy errors.
export const onRequestError = Sentry.captureRequestError;
