'use client';
import { Analytics } from '@vercel/analytics/next';
import { stripQuery } from '@/lib/monitoring/scrub';

// Client wrapper: beforeSend is a function and cannot come from the server
// layout. Visits are counted without cookies; no query string ever leaves
// (order access tokens, Stripe return parameters, search terms).
export function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => ({ ...event, url: stripQuery(event.url) })}
    />
  );
}
