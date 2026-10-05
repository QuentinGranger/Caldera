import type { Breadcrumb, Event } from '@sentry/nextjs';

// Order links carry a 180-day access token (?access=) and Stripe return URLs a
// PaymentIntent client secret: no query string ever leaves for a monitoring tool.
export function stripQuery(value: string) {
  return value.replace(/[?#][^\s"']*/g, '');
}

const urlKeys = ['url', 'from', 'to', 'http.url', 'url.full', 'http.query'];
const sensitiveKey =
  /(^|[._-])(token|secret|password|authorization|cookie|api[_-]?key|session|access)([._-]|$)/i;

function scrubData(
  data: Record<string, unknown> | undefined,
  seen = new WeakSet<object>(),
  depth = 0,
) {
  if (!data || seen.has(data)) return;
  seen.add(data);
  for (const key of Object.keys(data)) {
    if (key === 'url.query' || sensitiveKey.test(key)) {
      delete data[key];
    } else if (urlKeys.includes(key) && typeof data[key] === 'string') {
      data[key] = stripQuery(data[key]);
    } else if (data[key] && typeof data[key] === 'object') {
      if (depth >= 8) delete data[key];
      else scrubData(data[key] as Record<string, unknown>, seen, depth + 1);
    }
  }
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
    delete event.request.data;
    delete event.request.env;
    if (event.request.headers) {
      // Header names are case insensitive. An allowlist prevents custom auth
      // headers (and differently cased Cookie headers) from reaching Sentry.
      for (const name of Object.keys(event.request.headers)) {
        if (!['user-agent', 'content-type'].includes(name.toLowerCase())) {
          delete event.request.headers[name];
        }
      }
    }
  }
  delete event.user;
  delete event.extra;
  if (event.message) event.message = stripQuery(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = stripQuery(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = stripQuery(frame.filename);
      if (frame.abs_path) frame.abs_path = stripQuery(frame.abs_path);
      delete frame.vars;
    }
  }
  if (event.tags) {
    for (const name of Object.keys(event.tags)) {
      if (sensitiveKey.test(name)) delete event.tags[name];
      else if (typeof event.tags[name] === 'string')
        event.tags[name] = stripQuery(event.tags[name]);
    }
  }
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = stripQuery(span.description);
    scrubData(span.data);
  }
  scrubData(event.contexts as Record<string, unknown> | undefined);
  return event;
}
