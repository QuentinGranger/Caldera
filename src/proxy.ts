import { NextRequest, NextResponse } from 'next/server';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
// www serves the same pages as the apex: one canonical host (308, path and query kept).
function apexRedirect(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase().replace(/:\d+$/, '');
  if (host !== `www.${PRODUCTION_HOST}`) return null;
  // Assigned, never resolved: a path starting with // cannot change the host.
  const target = new URL(PRODUCTION_SITE_URL);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 308);
}
// Sentry ingest host, derived from the public DSN: the browser posts errors there.
function sentryOrigin() {
  try {
    return ` ${new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? '').origin}`;
  } catch {
    return '';
  }
}
export function proxy(request: NextRequest) {
  const redirect = apexRedirect(request);
  if (redirect) return redirect;
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://*.js.stripe.com${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com https://*.link.com",
    "font-src 'self'",
    `connect-src 'self' https://api.stripe.com https://*.js.stripe.com https://link.com https://*.link.com${sentryOrigin()}${dev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    'frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://link.com https://*.link.com',
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (
    request.nextUrl.pathname === '/admin' ||
    request.nextUrl.pathname.startsWith('/admin/')
  ) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico).*)'],
};
