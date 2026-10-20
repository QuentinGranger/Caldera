import { getPrisma } from '@/lib/db/prisma';
import { verifyStockAlertRemovalToken } from '@/lib/stock-alerts/tokens';
import { oneClickRequestError, oneClickResponse } from '@/lib/email/one-click';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const invalid = await oneClickRequestError(request);
  if (invalid) return oneClickResponse(invalid);
  const id = verifyStockAlertRemovalToken(
    new URL(request.url).searchParams.get('token'),
  );
  if (!id) return oneClickResponse(400);
  try {
    await getPrisma().stockAlert.deleteMany({ where: { id } });
    return oneClickResponse(200);
  } catch {
    console.error(
      JSON.stringify({
        scope: 'stock_alerts',
        action: 'one_click_unavailable',
      }),
    );
    return oneClickResponse(503);
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!verifyStockAlertRemovalToken(token)) return oneClickResponse(400);
  const url = new URL('/alertes/desinscription', request.url);
  url.hash = new URLSearchParams({ token: token! }).toString();
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.href,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
