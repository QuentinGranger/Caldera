import { NextResponse } from 'next/server';

import { getPrisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };

  try {
    await getPrisma().$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: 'ok', database: 'connected' },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'disconnected' },
      { status: 503, headers },
    );
  }
}
