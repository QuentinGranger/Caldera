import { getCartCookie } from '@/lib/cart/cartCookie';
import { getPrisma } from '@/lib/db/prisma';
import { invoicePdfResponse } from '@/lib/invoices/response';
import { getCustomerOrder } from '@/lib/orders/queries';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same access as the order page: the buyer's cart or the signed e-mail link. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string; invoiceId: string }> },
) {
  const { publicId, invoiceId } = await params;
  const order = await getCustomerOrder(
    publicId,
    await getCartCookie(),
    new URL(request.url).searchParams.get('access'),
  );
  const invoice =
    order && UUID.test(invoiceId)
      ? await getPrisma().invoice.findFirst({
          where: { id: invoiceId, orderId: order.id },
          select: { number: true, snapshot: true },
        })
      : null;
  if (!invoice) return new Response('Document introuvable.', { status: 404 });
  return invoicePdfResponse(invoice);
}
