import { NextRequest, NextResponse } from 'next/server';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL, siteOrigin } from '@/lib/site';
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
// Products withdrawn for good answer 410 Gone (src/lib/product/gone.ts). The
// list is read at most every 5 minutes per instance; a failed read keeps the
// previous list and is retried a minute later.
const GONE_TTL = 300_000;
let goneProducts = { at: 0, slugs: new Set<string>() };
let goneRefresh: Promise<void> | null = null;
// Always the configured origin, never the request Host header: a forged host
// must not decide which products answer 410.
async function refreshGoneProducts() {
  try {
    const response = await fetch(new URL('/api/seo/gone', siteOrigin()), {
      signal: AbortSignal.timeout(2000),
    });
    const data = (await response.json()) as { products?: unknown };
    if (!response.ok || !Array.isArray(data.products)) throw new Error();
    goneProducts = {
      at: Date.now(),
      slugs: new Set(
        data.products.filter(
          (slug): slug is string => typeof slug === 'string',
        ),
      ),
    };
  } catch {
    goneProducts = { ...goneProducts, at: Date.now() - GONE_TTL + 60_000 };
  }
}
async function isGoneProduct(request: NextRequest) {
  const match = /^\/produit\/([^/]+)$/.exec(request.nextUrl.pathname);
  if (!match?.[1]) return false;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  if (Date.now() - goneProducts.at > GONE_TTL) {
    goneRefresh ??= refreshGoneProducts().finally(() => {
      goneRefresh = null;
    });
    await goneRefresh;
  }
  return goneProducts.slugs.has(slug);
}
function goneResponse() {
  return new NextResponse(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Produit retiré | Caldera</title></head><body style="margin:0;padding:4rem 1rem;background:#fffcf5;color:#071c17;font-family:Georgia,serif;text-align:center"><h1>Ce produit n’est plus proposé.</h1><p>Il a été retiré définitivement du catalogue.</p><p><a href="/catalogue">Parcourir le catalogue</a> · <a href="/">Accueil</a></p></body></html>',
    {
      status: 410,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=300',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
export async function proxy(request: NextRequest) {
  const redirect = apexRedirect(request);
  if (redirect) return redirect;
  if (await isGoneProduct(request)) return goneResponse();
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
  const { pathname } = request.nextUrl;
  if (
    ['/admin', '/compte', '/newsletter'].some(
      (area) => pathname === area || pathname.startsWith(`${area}/`),
    )
  ) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico).*)'],
};
