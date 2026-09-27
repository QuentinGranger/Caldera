export const MAX_GUEST_FAVORITES = 50;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProductId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** A compact, bounded value suitable for an HTTP cookie. Newest IDs come first. */
export function parseFavoriteSession(value: string | undefined): string[] {
  if (!value) return [];
  const unique = new Set<string>();
  for (const candidate of value.split(',')) {
    const id = candidate.trim().toLowerCase();
    if (isProductId(id)) unique.add(id);
    if (unique.size >= MAX_GUEST_FAVORITES) break;
  }
  return [...unique];
}

export function serializeFavoriteSession(ids: readonly string[]): string {
  return parseFavoriteSession(ids.join(',')).join(',');
}

export function addFavoriteToSession(
  ids: readonly string[],
  productId: string,
): { ids: string[]; full: boolean } {
  const current = parseFavoriteSession(ids.join(','));
  const alreadyPresent = current.includes(productId);
  if (!alreadyPresent && current.length >= MAX_GUEST_FAVORITES)
    return { ids: current, full: true };
  return {
    ids: [productId, ...current.filter((id) => id !== productId)],
    full: false,
  };
}
