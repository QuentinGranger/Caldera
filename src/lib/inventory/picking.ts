import 'server-only';
import type { getAdminOrder } from '@/lib/admin/queries';
import { inventoryControls } from './controls';

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

export async function getPickList(order: Pick<Order, 'items' | 'refunds'>) {
  const refundedQuantities = new Map<string, number>();
  for (const refund of order.refunds) {
    if (refund.status !== 'SUCCEEDED') continue;
    for (const row of refund.items)
      refundedQuantities.set(
        row.orderItemId,
        (refundedQuantities.get(row.orderItemId) ?? 0) + row.quantity,
      );
  }
  const pickItems = order.items.flatMap((item) => {
    const quantity = item.quantity - (refundedQuantities.get(item.id) ?? 0);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
  const { profiles } = await inventoryControls(
    pickItems.flatMap((row) => (row.variantId ? [row.variantId] : [])),
  );
  return pickItems
    .map((item) => ({
      ...item,
      location: item.variantId
        ? (profiles.get(item.variantId)?.location ?? null)
        : null,
    }))
    .sort((a, b) => {
      if (a.location === null && b.location !== null) return 1;
      if (b.location === null && a.location !== null) return -1;
      return (
        (a.location ?? '').localeCompare(b.location ?? '', 'fr', {
          numeric: true,
        }) || a.sku.localeCompare(b.sku, 'fr')
      );
    });
}
