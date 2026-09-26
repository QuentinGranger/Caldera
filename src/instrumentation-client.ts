import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/monitoring/sentry';

// No session replay: it would record customers' screens, addresses included.
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
