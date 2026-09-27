import 'server-only';

import { cookies } from 'next/headers';
import { parseFavoriteSession, serializeFavoriteSession } from './sessionValue';

const FAVORITES_COOKIE = 'caldera_favorites';

export async function getGuestFavoriteIds() {
  return parseFavoriteSession((await cookies()).get(FAVORITES_COOKIE)?.value);
}

export async function setGuestFavoriteIds(ids: readonly string[]) {
  const cookieStore = await cookies();
  const value = serializeFavoriteSession(ids);
  if (!value) {
    cookieStore.delete(FAVORITES_COOKIE);
    return;
  }
  cookieStore.set(FAVORITES_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    priority: 'medium',
  });
}

export async function clearGuestFavorites() {
  (await cookies()).delete(FAVORITES_COOKIE);
}
