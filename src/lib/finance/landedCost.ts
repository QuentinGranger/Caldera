import { Prisma } from '@/generated/prisma/client';

type CostParts = {
  costPrice: Prisma.Decimal | null | undefined;
  inboundShippingCost?: Prisma.Decimal | null;
  procurementFees?: Prisma.Decimal | null;
};

/**
 * Inventory acquisition cost for one unit.
 * Customer fulfilment costs (packaging, Stripe, outbound shipping) are intentionally excluded.
 */
export function landedCost({
  costPrice,
  inboundShippingCost,
  procurementFees,
}: CostParts) {
  if (costPrice == null) return null;
  return costPrice
    .plus(inboundShippingCost ?? 0)
    .plus(procurementFees ?? 0);
}
