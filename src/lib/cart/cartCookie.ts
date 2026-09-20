import 'server-only';
import { cookies } from 'next/headers';
import { CART_COOKIE_NAME, CART_LIFETIME_SECONDS } from './constants';
export async function getCartCookie() {
  return (await cookies()).get(CART_COOKIE_NAME)?.value;
}
export async function setCartCookie(token: string) {
  (await cookies()).set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CART_LIFETIME_SECONDS,
  });
}
