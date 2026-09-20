import { getCartCookie } from '@/lib/cart/cartCookie';
import { reconcileOwnedOrder } from '@/lib/payments/reconcile';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const publicId = (await params).publicId;
  const token = await getCartCookie();

  const order = await reconcileOwnedOrder(publicId, token, {
    minIntervalMs: 5000,
  });

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
