import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { MAX_CART_LINES } from './constants';
import { cartExpiry, cartTokenHash, newCartToken } from './identity';
import { cartVariantSelect } from './queries';
import {
  CartError,
  assertPurchasable,
  validateId,
  validateQuantity,
} from './validation';

type Mutation =
  | { kind: 'add'; variantId: unknown; quantity: unknown }
  | { kind: 'update'; itemId: unknown; quantity: unknown }
  | { kind: 'remove'; itemId: unknown }
  | { kind: 'clear' };

// Serializable + bounded retries protect cumulative quantity and unique lines.
// Only the cookie adapter supplies the token; public actions never accept it.
export async function mutateCart(
  token: string | undefined,
  mutation: Mutation,
): Promise<string> {
  const id =
    mutation.kind === 'add'
      ? validateId(mutation.variantId)
      : mutation.kind !== 'clear'
        ? validateId(mutation.itemId)
        : undefined;
  const quantity =
    mutation.kind === 'add' || mutation.kind === 'update'
      ? validateQuantity(mutation.quantity)
      : undefined;
  const tokenHash = cartTokenHash(token);
  const replacementToken = newCartToken();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await getPrisma().$transaction(
        async (tx) => {
          let cart = tokenHash
            ? await tx.cart.findUnique({
                where: { tokenHash },
                select: { id: true, status: true, expiresAt: true },
              })
            : null;
          let resultToken = token;
          if (
            !cart ||
            cart.status !== 'ACTIVE' ||
            cart.expiresAt <= new Date()
          ) {
            if (mutation.kind !== 'add')
              throw new CartError(
                'Votre panier a expiré ou est introuvable. Ajoutez à nouveau les articles souhaités.',
              );
            if (cart?.status === 'ACTIVE')
              await tx.cart.update({
                where: { id: cart.id },
                data: { status: 'ABANDONED' },
              });
            cart = await tx.cart.create({
              data: {
                tokenHash: cartTokenHash(replacementToken)!,
                expiresAt: cartExpiry(),
              },
              select: { id: true, status: true, expiresAt: true },
            });
            resultToken = replacementToken;
          }
          // Every mutation writes this row: competing operations on one cart serialize.
          await tx.cart.update({
            where: { id: cart.id },
            data: { expiresAt: cartExpiry() },
          });
          const paymentOrder = await tx.order.findFirst({
            where: {
              checkoutSession: { cartId: cart.id },
              status: {
                in: [
                  'PENDING_PAYMENT',
                  'PAYMENT_FAILED',
                  'PAYMENT_PROCESSING',
                  'PAYMENT_REVIEW',
                ],
              },
            },
            select: { id: true },
          });
          if (paymentOrder)
            throw new CartError(
              'Un paiement est en cours. Reprenez ou annulez cette tentative depuis le checkout avant de modifier le panier.',
            );
          if (mutation.kind === 'clear') {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          } else if (mutation.kind === 'add') {
            const variant = await tx.productVariant.findUnique({
              where: { id: id! },
              select: cartVariantSelect,
            });
            const existing = await tx.cartItem.findUnique({
              where: { cartId_variantId: { cartId: cart.id, variantId: id! } },
            });
            const total = (existing?.quantity ?? 0) + quantity!;
            validateQuantity(total);
            assertPurchasable(variant, total);
            if (existing)
              await tx.cartItem.update({
                where: { id: existing.id, cartId: cart.id },
                data: { quantity: total },
              });
            else {
              if (
                (await tx.cartItem.count({ where: { cartId: cart.id } })) >=
                MAX_CART_LINES
              )
                throw new CartError(
                  'Votre panier contient déjà 100 références. Retirez un article avant de continuer.',
                );
              await tx.cartItem.create({
                data: { cartId: cart.id, variantId: id!, quantity: total },
              });
            }
          } else {
            const item = await tx.cartItem.findFirst({
              where: { id: id!, cartId: cart.id },
              select: { id: true, variant: { select: cartVariantSelect } },
            });
            if (!item)
              throw new CartError(
                'Cet article n’appartient pas à votre panier.',
              );
            if (mutation.kind === 'remove')
              await tx.cartItem.delete({
                where: { id: item.id, cartId: cart.id },
              });
            else {
              assertPurchasable(item.variant, quantity!);
              await tx.cartItem.update({
                where: { id: item.id, cartId: cart.id },
                data: { quantity: quantity! },
              });
            }
          }
          await tx.checkoutSession.updateMany({
            where: {
              cartId: cart.id,
              status: { in: ['IN_PROGRESS', 'READY_FOR_PAYMENT'] },
            },
            data: {
              status: 'IN_PROGRESS',
              readyFingerprint: null,
              shippingAmount: null,
            },
          });
          return resultToken!;
        },
        { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 3
      )
        continue;
      throw error;
    }
  }
  throw new CartError('Le panier est occupé. Réessayez.');
}
