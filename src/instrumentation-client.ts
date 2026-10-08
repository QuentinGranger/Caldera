import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/monitoring/sentry';
import { beginNavigation } from '@/lib/transitions/runtime';

// No session replay: it would record customers' screens, addresses included.
Sentry.init(sentryOptions);

/**
 * Every App Router navigation starts here, inside its React transition:
 * the page transition is chosen first (src/lib/transitions), then Sentry
 * traces the navigation as before.
 */
export const onRouterTransitionStart: typeof Sentry.captureRouterTransitionStart =
  (url, navigationType) => {
    beginNavigation(url, navigationType);
    Sentry.captureRouterTransitionStart(url, navigationType);
  };
