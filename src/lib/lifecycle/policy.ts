export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const LIFECYCLE_KINDS = [
  'WELCOME',
  'CART_FIRST',
  'CART_SECOND',
  'NEW_ARRIVAL',
  'POST_PURCHASE',
  'COMPLEMENTS',
  'FAVORITE_RESTOCK',
  'FAVORITE_PRICE',
  'LOW_STOCK',
  'WIN_BACK',
] as const;
export type LifecycleKind = (typeof LIFECYCLE_KINDS)[number];
export const personalKinds = new Set<LifecycleKind>(
  LIFECYCLE_KINDS.filter(
    (kind) => kind !== 'WELCOME' && kind !== 'NEW_ARRIVAL',
  ),
);
export function ageBetween(
  date: Date | null,
  now: Date,
  min: number,
  max: number,
) {
  return (
    date !== null &&
    now.getTime() - date.getTime() >= min &&
    now.getTime() - date.getTime() < max
  );
}
export function cartStage(activity: Date, now: Date): LifecycleKind | null {
  if (ageBetween(activity, now, 4 * DAY, 7 * DAY)) return 'CART_SECOND';
  return ageBetween(activity, now, DAY, 3 * DAY) ? 'CART_FIRST' : null;
}
export function lowStock(stock: number, threshold: number) {
  return (
    Number.isInteger(stock) && stock > 0 && stock <= Math.min(3, threshold)
  );
}
export function commercialFrequencyAllowed(attempts: Date[], now: Date) {
  return (
    !attempts.some((at) => now.getTime() - at.getTime() < 3 * DAY) &&
    attempts.filter((at) => now.getTime() - at.getTime() < 30 * DAY).length < 3
  );
}
