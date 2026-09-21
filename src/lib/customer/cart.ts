import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { getCartCookie, setCartCookie } from '@/lib/cart/cartCookie';
import { cartExpiry, cartTokenHash, newCartToken } from '@/lib/cart/identity';
import { MAX_CART_ITEM_QUANTITY } from '@/lib/cart/constants';

export async function attachCustomerCart(customerId: string) {
  const rawGuestToken = await getCartCookie();
  const guestHash = cartTokenHash(rawGuestToken);
  if (!guestHash) return { adjusted: false };
  const replacement = newCartToken();
  const result = await getPrisma().$transaction(
    async (tx) => {
      const guest = await tx.cart.findUnique({
        where: { tokenHash: guestHash },
        include: { items: true },
      });
      if (!guest || guest.status !== 'ACTIVE' || guest.expiresAt <= new Date())
        return { token: rawGuestToken, adjusted: false };
      const existing = await tx.cart.findFirst({
        where: {
          customerId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
          NOT: { id: guest.id },
        },
        include: { items: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (!existing) {
        await tx.cart.update({
          where: { id: guest.id },
          data: { customerId, expiresAt: cartExpiry() },
        });
        return { token: rawGuestToken, adjusted: false };
      }
      const merged = await tx.cart.create({
        data: {
          tokenHash: cartTokenHash(replacement)!,
          customerId,
          expiresAt: cartExpiry(),
          items: { create: [] },
        },
        select: { id: true },
      });
      const quantities = new Map<string, number>();
      for (const item of [...existing.items, ...guest.items])
        quantities.set(
          item.variantId,
          (quantities.get(item.variantId) ?? 0) + item.quantity,
        );
      let adjusted = false;
      for (const [variantId, wanted] of quantities) {
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          select: { availableQuantity: true, isActive: true },
        });
        if (!variant?.isActive || variant.availableQuantity <= 0) {
          adjusted = true;
          continue;
        }
        const quantity = Math.min(
          wanted,
          variant.availableQuantity,
          MAX_CART_ITEM_QUANTITY,
        );
        if (quantity < wanted) adjusted = true;
        await tx.cartItem.create({
          data: { cartId: merged.id, variantId, quantity },
        });
      }
      await tx.cart.updateMany({
        where: { id: { in: [guest.id, existing.id] } },
        data: { status: 'ABANDONED' },
      });
      return { token: replacement, adjusted };
    },
    { isolationLevel: 'Serializable', timeout: 10000 },
  );
  await setCartCookie(result.token!);
  return { adjusted: result.adjusted };
}
