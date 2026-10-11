import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/db/prisma';
export const MEASUREMENT_COOKIE = 'caldera_measurement';
const key = () => process.env.BETTER_AUTH_SECRET;
export function measurementHash(value: string) {
  const secret = key();
  if (!secret) return null;
  return createHmac('sha256', secret)
    .update('caldera:measurement:' + value)
    .digest('hex');
}
export function measurementToken(id: string) {
  const stamp = Date.now();
  return `${id}.${stamp}.${measurementHash(`${id}.${stamp}`)}`;
}
export function measurementId(value: string | undefined) {
  if (!value) return null;
  const [id, stamp, signature, ...extra] = value.split('.');
  if (
    extra.length ||
    !id ||
    !/^[a-f0-9-]{36}$/.test(id) ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !stamp ||
    !/^\d{13}$/.test(stamp) ||
    Number(stamp) > Date.now() ||
    Date.now() - Number(stamp) > 1800000
  )
    return null;
  const expected = measurementHash(`${id}.${stamp}`);
  return expected &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ? id
    : null;
}
/** Best effort after order preparation, outside payment/stock transaction. Never makes a payment fail. */
export async function attributePreparedOrder(orderId: string) {
  if (process.env.MEASUREMENT_ENABLED !== 'true') return;
  try {
    const id = measurementId((await cookies()).get(MEASUREMENT_COOKIE)?.value);
    if (!id) return;
    const db = getPrisma();
    if (
      !(await db.measurementSession.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      return;
    await db.measurementOrder.upsert({
      where: { orderId },
      create: { orderId, sessionId: id },
      update: {},
    });
  } catch {
    console.warn('[measurement] attribution unavailable');
  }
}

export async function purgeMeasurement() {
  if (process.env.MEASUREMENT_ENABLED !== 'true')
    return { measurementPurged: 0 };
  const deleted = await getPrisma().measurementSession.deleteMany({
    where: { startedAt: { lt: new Date(Date.now() - 90 * 86400000) } },
  });
  return { measurementPurged: deleted.count };
}
