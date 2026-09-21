import 'server-only';
import { randomBytes } from 'node:crypto';
import { cartTokenHash } from '@/lib/cart/identity';
import { readCheckout } from '@/lib/checkout/queries';
import { validateCheckout } from '@/lib/checkout/validation';
import { parseId } from '@/lib/checkout/schemas';
import { Prisma } from '@/generated/prisma/client';
import {
  OrderError,
  orderInclude,
  transaction,
  STOCK_RESERVATION_TTL,
  STORE_CURRENCY,
} from './common';
import { toStripeAmount } from '@/lib/stripe/amount';
import { getCurrentCustomer } from '@/lib/auth/customer/session';

export async function prepareOrder(
  token: string | undefined,
  rawSessionId: unknown,
) {
  const sessionId = parseId(rawSessionId),
    hash = cartTokenHash(token);
  if (!hash) throw new OrderError('Votre panier est introuvable.');
  const customer = await getCurrentCustomer();
  return transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { tokenHash: hash } });
    if (!cart) throw new OrderError('Votre panier est introuvable.');
    await tx.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });
    const existing = await tx.order.findUnique({
      where: { checkoutSessionId: sessionId },
      include: orderInclude,
    });
    if (existing) {
      if (existing.checkoutSession.cartId !== cart.id)
        throw new OrderError('Commande introuvable.');
      return existing;
    }
    const active = await tx.order.findFirst({
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
    });
    if (active)
      throw new OrderError(
        'Une tentative de paiement est déjà en cours. Reprenez-la depuis le checkout.',
      );
    const data = await readCheckout(tx, token);
    if (!data || data.session?.id !== sessionId)
      throw new OrderError('Cette session est introuvable.');
    const { view, fingerprint } = validateCheckout(data);
    if (
      view.status !== 'READY_FOR_PAYMENT' ||
      data.session.readyFingerprint !== fingerprint
    )
      throw new OrderError(
        'Votre panier ou les tarifs ont changé. Vérifiez et validez à nouveau le récapitulatif.',
      );
    const total = new Prisma.Decimal(view.total!);
    toStripeAmount(total); // Validate Stripe range before reserving anything.
    const method = data.methods.find((m) => m.id === view.selectedMethod!.id)!;
    for (const item of [...data.cart.items].sort((a, b) =>
      a.variantId.localeCompare(b.variantId),
    )) {
      const count =
        await tx.$executeRaw`UPDATE "ProductVariant" SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}, "updatedAt" = NOW() WHERE "id" = ${item.variantId}::uuid AND "isActive" = true AND "stockQuantity" - "reservedQuantity" >= ${item.quantity}`;
      if (count !== 1)
        throw new OrderError(
          'Un article vient d’être réservé. Vérifiez les quantités de votre panier.',
        );
    }
    const expiresAt = new Date(Date.now() + STOCK_RESERVATION_TTL);
    const { contact } = view;
    const order = await tx.order.create({
      data: {
        publicId: randomBytes(32).toString('hex'),
        orderNumber: `CAL-${new Date().getUTCFullYear()}-${randomBytes(10).toString('hex').toUpperCase()}`,
        checkoutSessionId: sessionId,
        customerId: customer?.id,
        email: contact.email,
        phone: contact.phone || null,
        currency: STORE_CURRENCY,
        subtotalAmount: view.cart.subtotal,
        shippingAmount: view.shippingAmount!,
        totalAmount: total,
        shippingMethodCode: method.code,
        shippingMethodName: method.name,
        items: {
          create: data.cart.items.map((item) => ({
            productId: item.variant.product.id,
            variantId: item.variantId,
            productName: item.variant.product.name,
            productSlug: item.variant.product.slug,
            sku: item.variant.sku,
            language: item.variant.language,
            unitPrice: item.variant.price,
            quantity: item.quantity,
            lineTotal: item.variant.price.mul(item.quantity),
            imageUrl: view.cart.items.find((i) => i.id === item.id)!.image,
          })),
        },
        addresses: {
          create: [
            { ...contact.shipping, role: 'SHIPPING' },
            {
              ...(contact.billingSame ? contact.shipping : contact.billing!),
              role: 'BILLING',
            },
          ],
        },
        ...(view.pickupPoint
          ? {
              pickupPoint: {
                create: {
                  provider: view.pickupPoint.provider,
                  pointId: view.pickupPoint.pointId,
                  type: view.pickupPoint.type,
                  name: view.pickupPoint.name,
                  address1: view.pickupPoint.address1,
                  address2: view.pickupPoint.address2,
                  postalCode: view.pickupPoint.postalCode,
                  city: view.pickupPoint.city,
                  countryCode: view.pickupPoint.countryCode,
                  latitude: view.pickupPoint.latitude,
                  longitude: view.pickupPoint.longitude,
                  distanceM: view.pickupPoint.distanceM,
                  openingHours: view.pickupPoint.openingHours ?? undefined,
                  selectedAt: data.session.pickupPoint!.selectedAt,
                },
              },
            }
          : {}),
        reservations: {
          create: data.cart.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            expiresAt,
          })),
        },
        payment: { create: { amount: total, currency: STORE_CURRENCY } },
      },
      include: orderInclude,
    });
    return order;
  });
}
