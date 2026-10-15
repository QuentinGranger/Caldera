import { recordCarnetReading } from '@/lib/carnets/analytics-record';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import {
  classifyChannel,
  MEASUREMENT_EVENTS,
  publicCampaign,
} from '@/lib/analytics/attribution';
import {
  MEASUREMENT_COOKIE,
  measurementHash,
  measurementId,
  measurementToken,
} from '@/lib/analytics/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const reply = (status: number) =>
    new NextResponse(null, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  if (process.env.MEASUREMENT_ENABLED !== 'true') return reply(204);
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return reply(403);
  if (Number(request.headers.get('content-length') ?? 0) > 2048)
    return reply(413);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply(413);
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return reply(400);
    const jar = await cookies();
    if (data.event === 'withdraw') {
      const id = measurementId(jar.get(MEASUREMENT_COOKIE)?.value);
      const db = getPrisma();
      const session = id
        ? await db.measurementSession.findUnique({
            where: { id },
            select: { visitorHash: true },
          })
        : null;
      const visitor =
        typeof data.visitor === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          data.visitor,
        )
          ? measurementHash(data.visitor)
          : null;
      const hash = session?.visitorHash ?? visitor;
      if (hash)
        await db.measurementSession.deleteMany({
          where: { visitorHash: hash },
        });
      jar.delete(MEASUREMENT_COOKIE);
      return reply(204);
    }
    if (
      data.consent !== true ||
      !MEASUREMENT_EVENTS.includes(data.event) ||
      typeof data.visitor !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        data.visitor,
      )
    )
      return reply(400);
    const db = getPrisma();
    const hash = measurementHash(data.visitor);
    if (!hash) return reply(503);
    // Separate fixed global ceiling, never consumes authentication limits.
    const limit = await db.$queryRaw<
      { count: number }[]
    >`INSERT INTO "CustomerAuthAttempt" (key,count,"windowStart") VALUES ('measurement-global',1,NOW()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN "CustomerAuthAttempt"."windowStart"<NOW()-INTERVAL '1 minute' THEN 1 ELSE "CustomerAuthAttempt".count+1 END,"windowStart"=CASE WHEN "CustomerAuthAttempt"."windowStart"<NOW()-INTERVAL '1 minute' THEN NOW() ELSE "CustomerAuthAttempt"."windowStart" END RETURNING count`;
    if ((limit[0]?.count ?? 1001) > 1000) return reply(429);
    let id = measurementId(jar.get(MEASUREMENT_COOKIE)?.value);
    const existing = id
      ? await db.measurementSession.findFirst({
          where: { id, visitorHash: hash },
          select: { id: true },
        })
      : null;
    const carnetEvent =
      data.event === 'carnet_view' || data.event === 'carnet_complete';
    if (carnetEvent && !existing) return reply(400);
    if (
      carnetEvent &&
      (typeof data.chapterId !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          data.chapterId,
        ) ||
        (data.access !== undefined &&
          (typeof data.access !== 'string' || data.access.length > 200)))
    )
      return reply(400);
    const flag =
      data.event === 'view_item'
        ? { productViewed: true }
        : data.event === 'add_to_cart'
          ? { cartAdded: true }
          : data.event === 'begin_checkout'
            ? { checkoutStarted: true }
            : data.event === 'add_payment_info'
              ? { paymentStarted: true }
              : {};
    if (existing)
      await db.measurementSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), ...flag },
      });
    else {
      id = randomUUID();
      const acquisition = classifyChannel(
        data.source,
        data.medium,
        data.referrer,
      );
      await db.measurementSession.create({
        data: {
          id,
          visitorHash: hash,
          ...acquisition,
          campaign: publicCampaign(data.campaign),
          ...flag,
        },
      });
    }
    if (id && (carnetEvent || data.event === 'view_item'))
      await recordCarnetReading(id, {
        event: data.event,
        chapterId: data.chapterId,
        access: data.access,
        variantId: data.variantId,
      });
    jar.set(MEASUREMENT_COOKIE, measurementToken(id!), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1800,
    });
    return reply(204);
  } catch {
    return reply(503);
  }
}
