import type { Breadcrumb, Event } from '@sentry/nextjs';

// Order links carry a 180-day access token (?access=) and Stripe return URLs a
// PaymentIntent client secret: no query string ever leaves for a monitoring tool.
export function stripQuery(value: string) {
  return value.replace(/[?#][^\s"']*/g, '');
}

const urlKeys = ['url', 'from', 'to', 'http.url', 'url.full', 'http.query'];

function scrubData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const key of urlKeys)
    if (typeof data[key] === 'string') data[key] = stripQuery(data[key]);
  delete data['url.query'];
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb) {
  scrubData(breadcrumb.data);
  if (breadcrumb.message) breadcrumb.message = stripQuery(breadcrumb.message);
  return breadcrumb;
}

export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.referer;
    }
  }
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = stripQuery(span.description);
    scrubData(span.data);
  }
  scrubData(event.contexts?.trace?.data);
  return event;
}
