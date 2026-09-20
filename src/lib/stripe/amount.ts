import { Prisma } from '@/generated/prisma/client';
/** EUR only; no binary floating-point arithmetic or implicit rounding. */
export function toStripeAmount(value: Prisma.Decimal | string): number {
  const minor = new Prisma.Decimal(value).mul(100);
  if (
    !minor.isFinite() ||
    !minor.isInteger() ||
    minor.lessThan(50) ||
    minor.greaterThan(99999999)
  )
    throw new RangeError('Montant EUR non pris en charge par ce paiement.');
  return minor.toNumber();
}
