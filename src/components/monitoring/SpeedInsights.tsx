'use client';
import { SpeedInsights as VercelSpeedInsights } from '@vercel/speed-insights/next';
import { stripQuery } from '@/lib/monitoring/scrub';

// Client wrapper: beforeSend is a function and cannot come from the server layout.
export function SpeedInsights() {
  return (
    <VercelSpeedInsights
      beforeSend={(event) => ({ ...event, url: stripQuery(event.url) })}
    />
  );
}
