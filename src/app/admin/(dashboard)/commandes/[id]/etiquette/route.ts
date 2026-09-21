import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const shipment = await getPrisma().shipment.findFirst({
    where: { orderId: id, isPrimary: true, carrierCode: 'MONDIAL_RELAY' },
    select: { providerLabelUrl: true },
  });
  if (!shipment?.providerLabelUrl)
    return NextResponse.json(
      { error: 'Étiquette introuvable.' },
      { status: 404 },
    );
  const url = new URL(shipment.providerLabelUrl);
  if (
    url.protocol !== 'https:' ||
    !(
      url.hostname === 'mondialrelay.com' ||
      url.hostname.endsWith('.mondialrelay.com')
    )
  )
    return NextResponse.json(
      { error: 'URL d’étiquette refusée.' },
      { status: 502 },
    );
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    return NextResponse.json(
      { error: 'Étiquette indisponible.' },
      { status: 502 },
    );
  return new NextResponse(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/pdf',
      'Content-Disposition': 'inline; filename="etiquette-mondial-relay.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
