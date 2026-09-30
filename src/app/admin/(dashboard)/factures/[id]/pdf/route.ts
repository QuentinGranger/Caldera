import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';
import { invoicePdfResponse } from '@/lib/invoices/response';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const invoice = UUID.test(id)
    ? await getPrisma().invoice.findUnique({
        where: { id },
        select: { number: true, snapshot: true },
      })
    : null;
  if (!invoice) return new Response('Facture introuvable.', { status: 404 });
  return invoicePdfResponse(invoice);
}
