import { getCartCookie } from '@/lib/cart/cartCookie';
import { getOwnedOrder } from '@/lib/orders/queries';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const order = await getOwnedOrder(
    (await params).publicId,
    await getCartCookie(),
  );
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
