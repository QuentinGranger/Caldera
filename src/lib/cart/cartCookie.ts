import 'server-only';
import { cookies, headers } from 'next/headers';
import { secureCookieForHost } from '@/lib/cookies/secure';
import { CART_COOKIE_NAME, CART_LIFETIME_SECONDS } from './constants';
export async function getCartCookie() {
  return (await cookies()).get(CART_COOKIE_NAME)?.value;
}
export async function setCartCookie(token: string) {
  const requestHeaders = await headers();
  (await cookies()).set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookieForHost(
      requestHeaders.get('host'),
      requestHeaders.get('x-forwarded-proto'),
    ),
    path: '/',
    maxAge: CART_LIFETIME_SECONDS,
  });
}
