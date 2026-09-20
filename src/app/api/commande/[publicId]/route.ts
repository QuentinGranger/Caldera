import { getCartCookie } from '@/lib/cart/cartCookie';
import { getOwnedOrder } from '@/lib/orders/queries';
import { stripeGateway } from '@/lib/stripe/stripe';
import { reconcilePaymentIntent } from '@/lib/payments/events';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const publicId = (await params).publicId;
  const token = await getCartCookie();
  let order = await getOwnedOrder(publicId, token);

  if (
    order &&
    ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'PAYMENT_PROCESSING'].includes(
      order.status,
    ) &&
    order.payment?.providerPaymentIntentId &&
    order.reservations.length > 0 &&
    order.reservations.every(
      (reservation) => reservation.expiresAt <= new Date(),
    )
  ) {
    try {
      const intent = await stripeGateway.retrieve(
        order.payment.providerPaymentIntentId,
      );
      await reconcilePaymentIntent(intent);
      order = await getOwnedOrder(publicId, token);
    } catch {
      // Keep the last known DB state; the webhook/manual retry can reconcile later.
    }
  }

  return Response.json(
    order ? { status: order.status } : { error: 'Commande introuvable' },
    {
      status: order ? 200 : 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
