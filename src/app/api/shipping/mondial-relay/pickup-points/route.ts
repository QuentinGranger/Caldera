import { NextRequest, NextResponse } from 'next/server';
import { shippingProviders } from '@/lib/shipping/providers';
import { MondialRelayError } from '@/lib/shipping/providers/mondialRelay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const windows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 30;

function limited(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  const key = forwarded?.trim() || request.headers.get('x-real-ip') || 'local';
  const now = Date.now();
  const row = windows.get(key);
  if (!row || row.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > LIMIT;
}

export async function GET(request: NextRequest) {
  if (limited(request))
    return NextResponse.json(
      { error: 'Trop de recherches. Patientez quelques instants.' },
      { status: 429 },
    );
  const postalCode =
    request.nextUrl.searchParams.get('postalCode')?.trim() ?? '';
  const city = request.nextUrl.searchParams.get('city')?.trim() ?? '';
  const countryCode = (
    request.nextUrl.searchParams.get('countryCode') ?? 'FR'
  ).toUpperCase();
  if (
    !/^[A-Z]{2}$/.test(countryCode) ||
    !/^[A-Za-z0-9 -]{3,10}$/.test(postalCode)
  )
    return NextResponse.json(
      { error: 'Renseignez un code postal valide.' },
      { status: 400 },
    );
  if (city && !/^[\p{L} .'-]{2,80}$/u.test(city))
    return NextResponse.json({ error: 'Ville invalide.' }, { status: 400 });
  try {
    const points = await shippingProviders.MONDIAL_RELAY.searchPickupPoints({
      countryCode,
      postalCode,
      city: city || undefined,
      limit: 15,
    });
    return NextResponse.json(
      { points },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (error) {
    const status =
      error instanceof MondialRelayError && error.code === 'NOT_CONFIGURED'
        ? 503
        : 502;
    return NextResponse.json(
      {
        error:
          error instanceof MondialRelayError
            ? error.message
            : 'La recherche Mondial Relay est momentanément indisponible.',
      },
      { status },
    );
  }
}
